import PreTokenizer from "@core/PreTokenizer";
import { create_pattern } from "@utils/core";

import type { TokenizerConfigPreTokenizerReplace } from "@static/tokenizer";

// NOTE: `Replace` PreTokenizer is custom (to support `BlenderbotSmallTokenizer`)
class Replace extends PreTokenizer {
  config: TokenizerConfigPreTokenizerReplace;
  pattern: RegExp | null;
  content: string;

  /**
   * @param config The configuration options for the pre-tokenizer.
   */
  constructor(config: TokenizerConfigPreTokenizerReplace) {
    super();
    this.config = config;
    this.pattern = create_pattern(this.config.pattern ?? {});
    this.content = this.config.content ?? "";
  }

  /**
   * Pre-tokenizes the input text by replacing certain characters.
   * @param text The text to be pre-tokenized.
   * @returns An array of tokens produced by replacing certain characters.
   */
  pre_tokenize_text(text: string): string[] {
    if (this.pattern === null) {
      return [text];
    }
    return [text.replaceAll(this.pattern, this.config.content ?? "")];
  }
}

export default Replace;
