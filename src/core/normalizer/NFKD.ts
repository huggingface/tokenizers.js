import UnicodeNormalizer from "./UnicodeNormalizer";

/**
 * A normalizer that applies Unicode normalization form KD (NFKD) to the input text.
 * Compatibility Decomposition.
 */
class NFKD extends UnicodeNormalizer {
  form: "NFKD" = "NFKD";
}

export default NFKD;
