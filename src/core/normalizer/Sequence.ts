import Normalizer from "../Normalizer";
import create_normalizer from "./create_normalizer";

import type { TokenizerConfigNormalizerSequence } from "@static/tokenizer";

/**
 * A Normalizer that applies a sequence of Normalizers.
 */
class Sequence extends Normalizer {
  normalizers: (Normalizer | null)[];

  /**
   * Create a new instance of NormalizerSequence.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigNormalizerSequence) {
    super(config);
    this.normalizers = (config.normalizers ?? []).map((x) =>
      create_normalizer(x),
    );
  }

  /**
   * Apply a sequence of Normalizers to the input text.
   * @param text The text to normalize.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    return this.normalizers.reduce((t, normalizer) => {
      return normalizer ? normalizer.normalize(t) : t;
    }, text);
  }
}

export default Sequence;
