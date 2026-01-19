import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerPrepend } from "@static/tokenizer";

/**
 * A Normalizer that prepends a string to the input string.
 */
class Prepend extends Normalizer {
  declare config: TokenizerConfigNormalizerPrepend;
  /**
   * Prepends the input string.
   * @param text The text to normalize.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    text = this.config.prepend + text;
    return text;
  }
}

export default Prepend;
