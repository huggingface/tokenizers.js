import PreTokenizer from "@core/PreTokenizer";
import { PUNCTUATION_REGEX } from "@static/constants";

import type { TokenizerConfigPreTokenizerPunctuation } from "@static/tokenizer";

/**
 * Splits text based on punctuation.
 */
class Punctuation extends PreTokenizer {
  config: TokenizerConfigPreTokenizerPunctuation;
  pattern: RegExp;

  /**
   * @param config The configuration options for the pre-tokenizer.
   */
  constructor(config: TokenizerConfigPreTokenizerPunctuation) {
    super();
    this.config = config;
    this.pattern = new RegExp(
      `[^${PUNCTUATION_REGEX}]+|[${PUNCTUATION_REGEX}]+`,
      "gu",
    );
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

export default Punctuation;
