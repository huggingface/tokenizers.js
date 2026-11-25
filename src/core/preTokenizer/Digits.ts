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
  pre_tokenize_text(text: string): Array<[string, [number, number]]> {
    return [...text.matchAll(this.pattern)].map(m => [m[0], [m.index!, m.index! + m[0].length]]);
  }
}

export default Digits;
