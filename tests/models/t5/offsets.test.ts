import fetchConfigById from "../../utils/fetchConfigById";
import { Tokenizer } from "../../../src";

// T5 pipeline: Precompiled normalizer → Sequence[WhitespaceSplit, Metaspace] → Unigram → TemplateProcessing (adds </s>)
//
// Key behaviours that shape every offset:
//
//  1. WhitespaceSplit splits on whitespace *before* Metaspace runs, so no space
//     character ever enters the Metaspace replacement logic for T5. Instead,
//     Metaspace prepends ▁ (U+2581) to every resulting chunk unconditionally
//     (prepend_scheme defaults to "always").
//
//  2. The Unigram lattice is built over the ▁-prefixed string (e.g. "▁Hello",
//     6 chars). The model returns node.pos and node.pos+node.length spans within
//     *that* string, then shifts them by word_start (the pre-token's start in
//     processed_text). This means the full-token span in processed_text is
//     [word_start, word_start + len("▁Hello")] = [0, 6], which reaches *one
//     character past* the end of the original word — landing on the following
//     space (or the end of text). to_orig then maps that processed-text index
//     through the alignment into the original character span.
//
//  3. The Precompiled (SentencePiece) normalizer may recompose decomposed Unicode.
//     build_alignment_map tracks these multi-char → single-char contractions so
//     that even NFD input produces offsets anchored in the original raw string.
//
//  4. Special tokens added by the post-processor (</s>) are not present in the
//     pre-model pair list and receive the [0, 0] sentinel offset.

describe("T5 offset mapping (Unigram + Metaspace + Precompiled normalizer)", () => {
  let tokenizer: Tokenizer;

  beforeAll(async () => {
    const { tokenizerJson, tokenizerConfig } =
      await fetchConfigById("google-t5/t5-small");
    tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  });

  test("Hello world — ▁ expansion pushes first token's end into the following space", () => {
    // WhitespaceSplit gives ["Hello",[0,5]] and ["world",[6,11]].
    // Metaspace prepends ▁ to each → "▁Hello" (6 chars) and "▁world" (6 chars).
    // Unigram keeps both as single tokens: lattice positions [0,6] within each.
    // "▁Hello": word_start=0, processed span [0,6].
    //   to_orig(0,6) → alignment[0]=0, alignment[6]=6 → [0,6].
    //   Original[0..6) = "Hello " — the ▁'s extra char absorbs the whitespace.
    // "▁world": word_start=6, processed span [6,12].
    //   to_orig(6,12) → alignment[6]=6, 12 >= len("Hello world")=11 → end=11 → [6,11].
    // "</s>" is injected by the post-processor and gets [0,0].
    const { tokens, offsets } = tokenizer.encode("Hello world");
    expect(tokens).toEqual(["▁Hello", "▁world", "</s>"]);
    expect(offsets).toEqual([
      [0, 6],   // "▁Hello" — end 6 reaches into the space, not 5
      [6, 11],  // "▁world"
      [0, 0],   // </s> — post-processor sentinel
    ]);
  });

  test("subword split — each Unigram lattice node maps independently to the original span", () => {
    // "tokenization" → WhitespaceSplit gives one chunk at [0,12].
    // Metaspace: "▁tokenization" (13 chars), word_start=0.
    // Unigram splits at best Viterbi path: "▁token" (pos=0,len=6) + "ization" (pos=6,len=7).
    //   "▁token":   processed span [0+0, 0+6]  = [0,6]  → to_orig → [0,6]
    //   "ization":  processed span [0+6, 0+13] = [6,13] → to_orig → alignment[6]=6,
    //               13 >= len("tokenization")=12 → end=12 → [6,12]
    const { tokens, offsets } = tokenizer.encode("tokenization");
    expect(tokens).toEqual(["▁token", "ization", "</s>"]);
    expect(offsets).toEqual([
      [0, 6],   // "▁token"
      [6, 12],  // "ization"
      [0, 0],
    ]);
  });

  test("café NFC — alignment is identity; accent codepoint inside a single char", () => {
    // NFC "café" (U+00E9 for é, length 4 in JS).
    // Normalizer leaves NFC input unchanged. WhitespaceSplit gives ["café",[0,4]].
    // Metaspace: "▁café" (5 chars), word_start=0.
    // Unigram keeps it as one token: processed span [0,5].
    //   to_orig(0,5) → alignment[0]=0, 5 >= len("café")=4 → end=4 → [0,4].
    const nfc = "café"; // precomposed é
    const { tokens, offsets } = tokenizer.encode(nfc);
    expect(tokens).toEqual(["▁café", "</s>"]);
    expect(offsets).toEqual([
      [0, 4],   // single NFC codepoint, 4 chars total
      [0, 0],
    ]);
  });

  test("café NFD — alignment map contracts decomposed e+combining-accent back to original span", () => {
    // NFD "café" (U+0065 + U+0301, length 5 in JS).
    // The Precompiled normalizer recomposes to NFC "café" (length 4).
    // build_alignment_map Case 3 (contraction): "é" → "é".
    //   alignment = [0, 1, 2, 3, 3]  (positions 3 and 4 in NFD both map to orig-3).
    // Unigram token "▁café" spans processed [0,5].
    //   to_orig(0,5) → alignment[0]=0; 5 >= len(normalized)=4 → end = len(original)=5 → [0,5].
    // End=5 spans both the 'e' (orig-3) and the combining accent (orig-4).
    const nfd = "café"; // decomposed é
    const { tokens, offsets } = tokenizer.encode(nfd);
    expect(tokens).toEqual(["▁café", "</s>"]);
    expect(offsets).toEqual([
      [0, 5],   // spans all 5 original chars including the combining mark
      [0, 0],
    ]);
  });

  test("leading-space input — ▁ not prepended to first word (already starts with ▁ equivalent); trailing subword gets zero-width span", () => {
    // " already spaced" — WhitespaceSplit gives ["already",[1,8]], ["spaced",[9,15]].
    // Metaspace prepends ▁ to each (neither starts with ▁ already).
    // Unigram on "▁already" (8 chars, word_start=1): single token, processed span [1,9].
    //   to_orig(1,9) → [1,9] = "already " (absorbs the space at orig-8).
    // Unigram on "▁spaced" (7 chars, word_start=9): splits "▁space"(6) + "d"(1).
    //   "▁space": processed [9,15] → to_orig(9,15) → alignment[9]=9, end=15 → [9,15].
    //   "d":      processed [15,16] → to_orig(15,16) → both 15 and 16 >= len=15 → [15,15].
    // "d" gets a zero-width [15,15] because its lattice position overshoots the
    // original text length after the ▁ expansion offset.
    const { tokens, offsets } = tokenizer.encode(" already spaced");
    expect(tokens).toEqual(["▁already", "▁space", "d", "</s>"]);
    expect(offsets).toEqual([
      [1, 9],   // "already " in original (absorbs the trailing space)
      [9, 15],  // "spaced" in original
      [15, 15], // "d" — zero-width, ▁ expansion pushed its start past original's end
      [0, 0],
    ]);
  });
});
