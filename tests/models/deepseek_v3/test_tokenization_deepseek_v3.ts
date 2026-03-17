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
  "onnx-internal-testing/tiny-random-DeepseekV3ForCausalLM": {
    SIMPLE: {
      text: BASE_TEST_STRINGS.SIMPLE,
      tokens: ["How", "Ġare", "Ġyou", "Ġdoing", "?"],
      ids: [0, 4117, 477, 440, 4843, 33],
      decoded: "<｜begin▁of▁sentence｜>How are you doing?",
    },
  },
};
