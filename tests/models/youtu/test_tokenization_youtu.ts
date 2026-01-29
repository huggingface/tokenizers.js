import { YOUTU_TEST_STRINGS } from "../../static/constants";
import { TestConfig } from "../../static/types";

const testConfig: TestConfig = {
  // - uses problematic (Python-specific) regex: \p{Hangul}, without Script= prefix
  "onnx-community/Youtu-LLM-2B-ONNX": {
    MIXED_HANGUL_ENGLISH: {
      text: YOUTU_TEST_STRINGS.MIXED_HANGUL_ENGLISH,
      tokens: ["a", "\u00ed\u0137\u013e", "\u00ea\u00b8\u0122", "b", "cd", "\u00ed\u0137\u013e", "e", "\u00ea\u00b8\u0122", "f"],
      ids: [64, 100670, 122559, 65, 6312, 100670, 68, 122559, 69],
      decoded: YOUTU_TEST_STRINGS.MIXED_HANGUL_ENGLISH,
    },
  },
};

export default testConfig;
