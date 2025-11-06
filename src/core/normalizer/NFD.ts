import UnicodeNormalizer from "./UnicodeNormalizer";

/**
 * A normalizer that applies Unicode normalization form D (NFD) to the input text.
 * Canonical Decomposition.
 */
class NFD extends UnicodeNormalizer {
  form: "NFD" = "NFD";
}

export default NFD;
