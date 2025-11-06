import Normalizer from "../Normalizer";
import { create_pattern } from "@utils/core";

import type { TokenizerConfigNormalizerReplace } from "@static/tokenizer";

/**
 * Replace normalizer that replaces occurrences of a pattern with a given string or regular expression.
 */
class Replace extends Normalizer {
  declare config: TokenizerConfigNormalizerReplace;

  /**
   * Normalize the input text by replacing the pattern with the content.
   * @param text The input text to be normalized.
   * @returns The normalized text after replacing the pattern with the content.
   */
  normalize(text: string): string {
    const pattern = create_pattern(this.config.pattern ?? {});
    return pattern === null
      ? text
      : text.replaceAll(pattern, this.config.content ?? "");
  }
}

export default Replace;
