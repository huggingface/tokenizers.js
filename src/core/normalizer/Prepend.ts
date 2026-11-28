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
    // Like Rust tokenizers, leave an empty string unchanged
    return text.length > 0 ? this.config.prepend + text : text;
  }
}

export default Prepend;
