import { BASE_TEST_STRINGS } from "../../static/constants";
import { TestConfig } from "../../static/types";

const testConfig: TestConfig = {
  // - uses a Unigram model with `byte_fallback: true` and a Metaspace pre-tokenizer that does not split
  // - see https://github.com/huggingface/tokenizers.js/issues/26
  "cl-nagoya/ruri-v3-30m": {
    SIMPLE: {
      text: BASE_TEST_STRINGS.SIMPLE,
      tokens: ["How", "▁are", "▁you", "▁doing", "?"],
      ids: [1, 1167, 334, 331, 1411, 369, 2],
      decoded: "<s>How are you doing?</s>",
    },
    OUT_OF_VOCABULARY_EMOJI: {
      text: "寿司🍣が好き",
      tokens: ["寿司", "<0xF0>", "<0x9F>", "<0x8D>", "<0xA3>", "が好き"],
      ids: [1, 13038, 255, 174, 156, 178, 13350, 2],
      decoded: "<s>寿司🍣が好き</s>",
    },
    OUT_OF_VOCABULARY_SYMBOLS: {
      text: "naïve café ₹8 🍣",
      tokens: ["n", "aï", "ve", "▁café", "▁", "<0xE2>", "<0x82>", "<0xB9>", "8", "▁", "<0xF0>", "<0x9F>", "<0x8D>", "<0xA3>"],
      ids: [1, 398, 65359, 604, 45844, 271, 241, 145, 200, 300, 271, 255, 174, 156, 178, 2],
      decoded: "<s>naïve café ₹8 🍣</s>",
    },
    MULTIBYTE_EMOJIS: {
      text: "✨ 🤗 👁️ 👱🏻 🕵‍♂️ 👩‍👩‍👧‍👦",
      tokens: ["✨", "▁", "<0xF0>", "<0x9F>", "<0xA4>", "<0x97>", "▁", "<0xF0>", "<0x9F>", "<0x91>", "<0x81>", "️", "▁", "<0xF0>", "<0x9F>", "<0x91>", "<0xB1>", "🏻", "▁", "<0xF0>", "<0x9F>", "<0x95>", "<0xB5>", "‍♂️", "▁", "<0xF0>", "<0x9F>", "<0x91>", "<0xA9>", "‍", "<0xF0>", "<0x9F>", "<0x91>", "<0xA9>", "‍", "<0xF0>", "<0x9F>", "<0x91>", "<0xA7>", "‍", "<0xF0>", "<0x9F>", "<0x91>", "<0xA6>"],
      ids: [1, 4620, 271, 255, 174, 179, 166, 271, 255, 174, 160, 144, 8127, 271, 255, 174, 160, 192, 41971, 271, 255, 174, 164, 196, 77331, 271, 255, 174, 160, 184, 47857, 255, 174, 160, 184, 47857, 255, 174, 160, 182, 47857, 255, 174, 160, 181, 2],
      decoded: "<s>✨ 🤗 👁️ 👱🏻 🕵‍♂️ 👩‍👩‍👧‍👦</s>",
    },
  },
};

export default testConfig;
