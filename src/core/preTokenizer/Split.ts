import PreTokenizer from "@core/PreTokenizer";
import { regex_split, create_pattern } from "@utils/core";

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
    // TODO support all behaviours (config.behavior)

    this.pattern = create_pattern(
      this.config.pattern ?? {},
      this.config.invert ?? true,
    );
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

    if (this.config.invert) {
      return text.match(this.pattern) || [];
    } else if (this.config.behavior?.toLowerCase() === "removed") {
      return text.split(this.pattern).filter((x) => x);
    } else {
      return regex_split(text, this.pattern);
    }
  }
}

export default Split;
