import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerPrecompiled } from "@static/tokenizer";

/**
 * Read-only view over the double-array trie (darts-clone layout) stored in a SentencePiece
 * `precompiled_charsmap`. Mirrors the `spm_precompiled` crate used by the Rust `tokenizers` library.
 */
class DoubleArray {
  private readonly units: Uint32Array;

  constructor(units: Uint32Array) {
    this.units = units;
  }

  private static has_leaf(unit: number): boolean {
    return ((unit >>> 8) & 1) === 1;
  }

  private static value(unit: number): number {
    return unit & 0x7fffffff;
  }

  private static label(unit: number): number {
    return unit & (0x80000000 | 0xff);
  }

  private static offset(unit: number): number {
    return (unit >>> 10) << ((unit & (1 << 9)) >>> 6);
  }

  /** Values of every key in the trie that is a prefix of `key`, shortest first. */
  common_prefix_search(key: Uint8Array): number[] {
    const results: number[] = [];
    let node_pos = 0;
    let unit = this.units[node_pos];
    node_pos ^= DoubleArray.offset(unit);
    for (const c of key) {
      if (c === 0) break;
      node_pos ^= c;
      unit = this.units[node_pos];
      if (unit === undefined || DoubleArray.label(unit) >>> 0 !== c)
        return results;
      node_pos ^= DoubleArray.offset(unit);
      if (DoubleArray.has_leaf(unit)) {
        results.push(DoubleArray.value(this.units[node_pos]));
      }
    }
    return results;
  }
}

const decode_base64 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MAX_CACHE_SIZE = 16384;

/** UTF-8 byte length of a string, without allocating. */
const utf8_length = (s: string): number => {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
};

// Grapheme segmentation only changes the result for multi-character graphemes shorter than 6 UTF-8 bytes
// (longer ones are looked up character by character anyway). Such clusters can only form through the
// grapheme-break rules that join a character to the next one with few bytes: CR x LF (GB3),
// x (Extend | ZWJ) (GB9), x SpacingMark (GB9a) and Prepend x (GB9b). The remaining joining rules (Hangul
// syllables, regional-indicator pairs, emoji ZWJ sequences, Indic conjuncts) always produce clusters of
// 6+ bytes, so splitting them does not change the per-character result.
const JOINS_PREVIOUS =
  /[\p{M}\u200C\u200D\uFF9E\uFF9F\u0E33\u0EB3\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/u;
const JOINS_NEXT =
  /[\r\u0600-\u0605\u06DD\u070F\u0890\u0891\u08E2\u0D4E\u{110BD}\u{110CD}\u{111C2}\u{111C3}\u{1193F}\u{11941}\u{11A3A}\u{11A84}-\u{11A89}\u{11D46}\u{11F02}]/u;

/** Whether `next` may belong to the same grapheme as `prev` (over-approximation, see above). */
const may_join = (prev: string, next: string): boolean => {
  // Nothing below U+0300 extends a grapheme, and CR is the only Prepend-like character below U+0600.
  if (next.codePointAt(0)! >= 0x300 && JOINS_PREVIOUS.test(next)) return true;
  const p = prev.codePointAt(0)!;
  return p === 0x0d || (p >= 0x600 && JOINS_NEXT.test(prev));
};

/**
 * A normalizer that applies a SentencePiece precompiled charsmap.
 *
 * The charsmap is a serialized double-array trie mapping UTF-8 byte sequences to replacement strings
 * (layout: little-endian u32 trie size in bytes, the trie units, then NUL-terminated replacements).
 * As in the Rust implementation, the text is processed one extended grapheme cluster at a time: a short
 * grapheme (< 6 UTF-8 bytes) is first looked up as a whole, otherwise each of its characters is looked
 * up individually.
 */
class Precompiled extends Normalizer {
  charsmap: string | null;
  private trie: DoubleArray | null = null;
  private normalized: Uint8Array | null = null;
  private segmenter: Intl.Segmenter | null = null;
  private cache = new Map<string, string>();

  /**
   * Create a new instance of Precompiled normalizer.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigNormalizerPrecompiled) {
    super(config);
    this.charsmap = config.precompiled_charsmap ?? null;
    if (this.charsmap) {
      const bytes = decode_base64(this.charsmap);
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      const trie_size = view.getUint32(0, true);
      const units = new Uint32Array(trie_size / 4);
      for (let i = 0; i < units.length; ++i)
        units[i] = view.getUint32(4 + i * 4, true);
      this.trie = new DoubleArray(units);
      this.normalized = bytes.subarray(4 + trie_size);
    }
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      this.segmenter = new Intl.Segmenter(undefined, {
        granularity: "grapheme",
      });
    }
  }

  /** Replacement for `chunk` if a charsmap key is a prefix of it, else `null`. */
  private transform(chunk: string): string | null {
    const results = this.trie!.common_prefix_search(encoder.encode(chunk));
    if (results.length === 0) return null;
    const start = results[0];
    let end = start;
    while (end < this.normalized!.length && this.normalized![end] !== 0) ++end;
    return decoder.decode(this.normalized!.subarray(start, end));
  }

  /** Normalized form of one grapheme cluster (memoized: real text repeats a small set of graphemes). */
  private normalize_grapheme(grapheme: string): string {
    const cached = this.cache.get(grapheme);
    if (cached !== undefined) return cached;
    let out = utf8_length(grapheme) < 6 ? this.transform(grapheme) : null;
    if (out === null) {
      out = "";
      for (const ch of grapheme) {
        const norm = this.transform(ch);
        out += norm !== null ? norm : ch;
      }
    }
    if (this.cache.size >= MAX_CACHE_SIZE) this.cache.clear();
    this.cache.set(grapheme, out);
    return out;
  }

  /**
   * Normalizes the given text by applying the precompiled charsmap.
   * @param text The text to normalize.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    if (!this.trie) {
      return this.approximate_nmt_nfkc(text);
    }
    // Walk code points and group runs of characters that may share a grapheme. A multi-character
    // grapheme can only be shorter than 6 UTF-8 bytes if it contains a character below U+0800 (two
    // characters of 3+ bytes are already 6 bytes), so only runs containing such a character need
    // Intl.Segmenter (which is slow); everything else is processed character by character.
    const chars = Array.from(text);
    let out = "";
    let i = 0;
    while (i < chars.length) {
      let j = i;
      let has_short_char = chars[i].codePointAt(0)! < 0x800;
      while (j + 1 < chars.length && may_join(chars[j], chars[j + 1])) {
        ++j;
        if (chars[j].codePointAt(0)! < 0x800) has_short_char = true;
      }
      if (j === i || !has_short_char || !this.segmenter) {
        for (let k = i; k <= j; ++k) out += this.normalize_grapheme(chars[k]);
      } else {
        const span = chars.slice(i, j + 1).join("");
        for (const { segment } of this.segmenter.segment(span)) {
          out += this.normalize_grapheme(segment);
        }
      }
      i = j + 1;
    }
    return out;
  }

  /**
   * Approximation of SentencePiece's default `nmt_nfkc` rule, used only when no charsmap is provided.
   * See https://github.com/google/sentencepiece/blob/master/doc/normalization.md
   */
  private approximate_nmt_nfkc(text: string): string {
    text = text.replace(
      /[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/gm,
      "",
    ); // Remove control characters
    text = text.replace(
      /[\u0009\u000A\u000C\u000D\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2581\u3000\uFEFF\uFFFD]/gm,
      " ",
    ); // Replace certain characters with a space

    if (text.includes("\uFF5E")) {
      // NFKC maps the Fullwidth Tilde (U+FF5E) to "~", but sentencepiece's nmt_nfkc does not.
      const parts = text.split("\uFF5E");
      return parts.map((part) => part.normalize("NFKC")).join("\uFF5E");
    }
    return text.normalize("NFKC");
  }
}

export default Precompiled;
