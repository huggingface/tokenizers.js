import PreTokenizer from "@core/PreTokenizer";
import { PUNCTUATION_REGEX } from "@static/constants";
import { split_with_behavior } from "@utils/core";

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
    // Each punctuation character is a delimiter of its own, as in Rust `tokenizers`
    this.pattern = new RegExp(
      `[^${PUNCTUATION_REGEX}]+|([${PUNCTUATION_REGEX}])`,
      "gu",
    );
  }

  /**
   * Tokenizes text by splitting it using the given pattern.
   * @param text The text to tokenize.
   * @returns An array of tokens.
   */
  pre_tokenize_text(text: string): string[] {
    const pieces = Array.from(
      text.matchAll(this.pattern),
      (match): [string, boolean] => [match[0], match[1] !== undefined],
    );
    return split_with_behavior(pieces, this.config.behavior ?? "Isolated");
  }
}

export default Punctuation;
