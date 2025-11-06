import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerPrecompiled } from "@static/tokenizer";

/**
 * A normalizer that applies a precompiled charsmap.
 * This is useful for applying complex normalizations in C++ and exposing them to JavaScript.
 */
class Precompiled extends Normalizer {
  charsmap: any;

  /**
   * Create a new instance of Precompiled normalizer.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigNormalizerPrecompiled) {
    super(config);
    this.charsmap = config.precompiled_charsmap ?? null;
  }

  /**
   * Normalizes the given text by applying the precompiled charsmap.
   * @param text The text to normalize.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    // As stated in the sentencepiece normalization docs (https://github.com/google/sentencepiece/blob/master/doc/normalization.md#use-pre-defined-normalization-rule),
    // there are 5 pre-defined normalization rules:
    //  1. nmt_nfkc: NFKC normalization with some additional normalization around spaces. (default)
    //  2. nfkc: original NFKC normalization.
    //  3. nmt_nfkc_cf: nmt_nfkc + Unicode case folding (mostly lower casing)
    //  4. nfkc_cf: nfkc + Unicode case folding.
    //  5. identity: no normalization
    //
    // For now, we only implement the default (nmt_nfkc).
    // See https://raw.githubusercontent.com/google/sentencepiece/master/data/nmt_nfkc.tsv for the full list of rules.
    // TODO: detect when a different `this.charsmap` is used.

    text = text.replace(
      /[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/gm,
      "",
    ); // Remove control characters
    text = text.replace(
      /[\u0009\u000A\u000C\u000D\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2581\u3000\uFEFF\uFFFD]/gm,
      "\u0020",
    ); // Replace certain characters with a space

    if (text.includes("\uFF5E")) {
      // To match the sentencepiece implementation 100%, we must handle a very strange edge-case.
      // For some reason, the "Fullwidth Tilde" character (\uFF5E) should not be converted to the standard Tilde character (\u007E).
      // However, NFKC normalization does do this conversion. As a result, we split the string on the Fullwidth Tilde character,
      // perform NFKC normalization on each substring, and then join them back together with the Fullwidth Tilde character.
      const parts = text.split("\uFF5E");
      text = parts.map((part) => part.normalize("NFKC")).join("\uFF5E");
    } else {
      text = text.normalize("NFKC");
    }

    return text;
  }
}

export default Precompiled;
