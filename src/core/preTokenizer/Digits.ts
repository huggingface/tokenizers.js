import PreTokenizer from "@core/PreTokenizer";

import type { TokenizerConfigPreTokenizerDigits } from "@static/tokenizer";

/**
 * Splits text based on digits.
 */
class Digits extends PreTokenizer {
  config: TokenizerConfigPreTokenizerDigits;
  pattern: RegExp;

  /**
   * @param config The configuration options for the pre-tokenizer.
   */
  constructor(config: TokenizerConfigPreTokenizerDigits) {
    super();
    this.config = config;

    // Construct a pattern which matches the rust implementation:
    const digit_pattern = `[^\\d]+|\\d${this.config.individual_digits ? "" : "+"}`;
    this.pattern = new RegExp(digit_pattern, "gu");
  }

  /**
   * Tokenizes text by splitting it using the given pattern.
   * @param text The text to tokenize.
   * @returns An array of tokens.
   */
  pre_tokenize_text(text: string): string[] {
    return text.match(this.pattern) || [];
  }
}

export default Digits;
