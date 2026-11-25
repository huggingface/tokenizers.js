import { PRECOMPILED_CHARSMAP_TEST_STRINGS } from "../../static/constants";

export default {
  "nvidia/parakeet-tdt-0.6b-v3": {
    EMOJI_ZWJ_SEQUENCE: {
      text: PRECOMPILED_CHARSMAP_TEST_STRINGS.EMOJI_ZWJ_SEQUENCE,
      tokens: ["\u2581famil", "y", "\u2581", "<unk>", "\u2581ok"],
      ids: [3993, 7893, 7863, 0, 2148],
      decoded: "family <unk> ok",
    },
    CYRILLIC_SUBSCRIPT_LETTERS: {
      text: PRECOMPILED_CHARSMAP_TEST_STRINGS.CYRILLIC_SUBSCRIPT_LETTERS,
      tokens: ["\u2581x", "<unk>", "\u2581y"],
      ids: [1451, 0, 459],
      decoded: "x<unk> y",
    },
  },
};
