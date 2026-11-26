import PreTokenizer from "@core/PreTokenizer";
import { create_pattern, regex_pieces, split_with_behavior } from "@utils/core";

import type { TokenizerConfigPreTokenizerSplit } from "@static/tokenizer";

/**
 * Splits text using a given pattern.
 */
class Split extends PreTokenizer {
  config: TokenizerConfigPreTokenizerSplit;
  pattern: RegExp | null;

  /**
   * @param config The configuration options for the pre-tokenizer.
   */
  constructor(config: TokenizerConfigPreTokenizerSplit) {
    super();
    this.config = config;
    this.pattern = create_pattern(this.config.pattern ?? {});
  }

  /**
   * Tokenizes text by splitting it using the given pattern.
   * @param text The text to tokenize.
   * @returns An array of tokens.
   */
  pre_tokenize_text(text: string): string[] {
    if (this.pattern === null) {
      return [];
    }

    return split_with_behavior(
      regex_pieces(text, this.pattern),
      this.config.behavior ?? "Isolated",
      this.config.invert ?? false,
    );
  }
}

export default Split;
