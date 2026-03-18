import { BASE_TEST_STRINGS } from "../../static/constants";

export default {
  "hf-internal-testing/tiny-random-DeepseekV3ForCausalLM": {
    SIMPLE: {
      text: BASE_TEST_STRINGS.SIMPLE,
      tokens: ["How", "Ġare", "Ġyou", "Ġdoing", "?"],
      ids: [0, 4117, 477, 440, 4843, 33],
      decoded: "<｜begin▁of▁sentence｜>How are you doing?",
    },
  },
  "hf-internal-testing/deepseek-v3-broken-tokenizer": {
    // Same as hf-internal-testing version, but saved with transformers v5.
    // This causes certain issues related to BPE and unk_tokens, which need to be addressed.
    // See https://github.com/huggingface/transformers/issues/44779
    SIMPLE: {
      text: BASE_TEST_STRINGS.SIMPLE,
      tokens: ["How", "are", "you", "doing", "?"],
      ids: [4117, 591, 12829, 62552, 33],
      decoded: "Howareyoudoing?",
    },
  },
};
