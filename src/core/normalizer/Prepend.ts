import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerStripPrepend } from "@static/tokenizer";

/**
 * A Normalizer that prepends a string to the input string.
 */
class Prepend extends Normalizer {
  declare config: TokenizerConfigNormalizerStripPrepend;
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
