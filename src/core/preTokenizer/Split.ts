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
  pre_tokenize_text(text: string): Array<[string, [number, number]]> {
    if (this.pattern === null) {
      return [];
    }

    if (this.config.invert) {
      return [...text.matchAll(this.pattern)].map((m) => [m[0], [m.index!, m.index! + m[0].length]]);
    } else if (this.config.behavior?.toLowerCase() === "removed") {
      const result: Array<[string, [number, number]]> = [];
      let prev = 0;
      for (const match of text.matchAll(this.pattern)) {
        if (prev < match.index!) {
          result.push([text.slice(prev, match.index!), [prev, match.index!]]);
        }
        prev = match.index! + match[0].length;
      }
      if (prev < text.length) {
        result.push([text.slice(prev), [prev, text.length]]);
      }
      return result;
    } else {
      return regex_split(text, this.pattern);
    }
  }
}

export default Split;
