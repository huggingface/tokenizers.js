import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerStrip } from "@static/tokenizer";

/**
 * A normalizer that strips leading and/or trailing whitespace from the input text.
 */
class Strip extends Normalizer {
  declare config: TokenizerConfigNormalizerStrip;
  /**
   * Strip leading and/or trailing whitespace from the input text.
   * @param text The input text.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    if (this.config.strip_left && this.config.strip_right) {
      // Fast path to avoid an extra trim call
      text = text.trim();
    } else {
      if (this.config.strip_left) {
        text = text.trimStart();
      }
      if (this.config.strip_right) {
        text = text.trimEnd();
      }
    }
    return text;
  }
}

export default Strip;
