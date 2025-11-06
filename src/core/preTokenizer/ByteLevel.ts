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
  pre_tokenize_text(text: string, options?: any): string[] {
    // Add a leading space if the option is enabled
    if (this.add_prefix_space && !text.startsWith(" ")) {
      text = " " + text;
    }

    // Split on whitespace and punctuation
    const tokens = this.use_regex ? text.match(this.pattern) || [] : [text];

    // Maps all our bytes to unicode strings, avoiding control tokens of the BPE (spaces in our case)
    return tokens.map((token) =>
      Array.from(
        this.text_encoder.encode(token),
        (byte) => this.byte_encoder[byte],
      ).join(""),
    );
  }
}

export default ByteLevel;
