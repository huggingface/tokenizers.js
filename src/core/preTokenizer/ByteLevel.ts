import PreTokenizer from "@core/PreTokenizer";
import { BYTES_TO_UNICODE } from "@static/constants";

import type { TokenizerConfigPreTokenizerByteLevel } from "@static/tokenizer";

/**
 * A pre-tokenizer that splits text into Byte-Pair-Encoding (BPE) subwords.
 */
class ByteLevel extends PreTokenizer {
  config: TokenizerConfigPreTokenizerByteLevel;
  add_prefix_space: boolean;
  trim_offsets: boolean;
  use_regex: boolean;
  pattern: RegExp;
  byte_encoder: Record<number, string>;
  text_encoder: TextEncoder;

  /**
   * Creates a new instance of the `ByteLevelPreTokenizer` class.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigPreTokenizerByteLevel) {
    super();
    this.config = config;

    /**
     * Whether to add a leading space to the first word.
     * This allows to treat the leading word just as any other word.
     */
    this.add_prefix_space = this.config.add_prefix_space ?? false;

    /**
     * Whether the post processing step should trim offsets
     * to avoid including whitespaces.
     * @todo Use this in the pretokenization step.
     */
    this.trim_offsets = this.config.trim_offsets ?? false;

    /**
     * Whether to use the standard GPT2 regex for whitespace splitting.
     * Set it to False if you want to use your own splitting. Defaults to true.
     */
    this.use_regex = this.config.use_regex ?? true;
    this.pattern =
      /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

    this.byte_encoder = BYTES_TO_UNICODE;
    this.text_encoder = new TextEncoder();
  }

  /**
   * Tokenizes a single piece of text using byte-level tokenization.
   * @param text The text to tokenize.
   * @param options Additional options for the pre-tokenization logic.
   * @returns An array of tokens.
   */
  pre_tokenize_text(text: string, options?: any): Array<[string, [number, number]]> {
    // Track whether we insert a synthetic space so we can correct span positions
    const prefixInserted = this.add_prefix_space && !text.startsWith(" ");
    if (prefixInserted) {
      text = " " + text;
    }

    // Capture raw token strings with their positions in the (possibly prefixed) text
    const rawTokens: Array<[string, number]> = this.use_regex
      ? [...text.matchAll(this.pattern)].map((m) => [m[0], m.index!])
      : [[text, 0]];

    // Offset converts positions in the prefixed text back to the original input
    const offset = prefixInserted ? -1 : 0;

    // Maps all our bytes to unicode strings, avoiding control tokens of the BPE (spaces in our case)
    return rawTokens.map(([token, index]) => {
      const start = Math.max(0, index + offset);
      const end = Math.max(0, index + token.length + offset);
      const encoded = Array.from(
        this.text_encoder.encode(token),
        (byte) => this.byte_encoder[byte],
      ).join("");
      return [encoded, [start, end]];
    });
  }
}

export default ByteLevel;
