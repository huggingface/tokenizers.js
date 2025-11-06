import Normalizer from "../Normalizer";
import { remove_accents } from "@utils/core";

import type { TokenizerConfigNormalizerStripAccents } from "@static/tokenizer";

/**
 * StripAccents normalizer removes all accents from the text.
 */
class StripAccents extends Normalizer {
  declare config: TokenizerConfigNormalizerStripAccents;
  /**
   * Remove all accents from the text.
   * @param text The input text.
   * @returns The normalized text without accents.
   */
  normalize(text: string): string {
    return remove_accents(text);
  }
}

export default StripAccents;
