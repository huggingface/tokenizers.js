import { BASE_TEST_STRINGS } from "../../static/constants";

export default {
  "jhu-clsp/mmBERT-base": {
    SIMPLE: {
      text: BASE_TEST_STRINGS.SIMPLE,
      tokens: ["\u2581How", "\u2581are", "\u2581you", "\u2581doing", "?"],
      ids: [2, 2250, 708, 692, 3900, 235336, 1],
      decoded: "<bos> How are you doing?<eos>",
    },
    NUMBERS: {
      text: BASE_TEST_STRINGS.NUMBERS,
      tokens: ["\u2581", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "\u2581", "0", "\u2581", "1", "\u2581", "2", "\u2581", "3", "\u2581", "4", "\u2581", "5", "\u2581", "6", "\u2581", "7", "\u2581", "8", "\u2581", "9", "\u2581", "1", "0", "\u2581", "1", "0", "0", "\u2581", "1", "0", "0", "0"],
      ids: [2, 235248, 235276, 235274, 235284, 235304, 235310, 235308, 235318, 235324, 235321, 235315, 235248, 235276, 235248, 235274, 235248, 235284, 235248, 235304, 235248, 235310, 235248, 235308, 235248, 235318, 235248, 235324, 235248, 235321, 235248, 235315, 235248, 235274, 235276, 235248, 235274, 235276, 235276, 235248, 235274, 235276, 235276, 235276, 1],
      decoded: "<bos> 0123456789 0 1 2 3 4 5 6 7 8 9 10 100 1000<eos>",
    },
    PYTHON_CODE: {
      text: BASE_TEST_STRINGS.PYTHON_CODE,
      tokens: ["\u2581def", "\u2581main", "():", "\n", "\u2581", "\t", "pass"],
      ids: [2, 1698, 1872, 4409, 108, 235248, 226, 3095, 1],
      decoded: "<bos> def main():\n \tpass<eos>",
    },
    NEWLINES: {
      text: BASE_TEST_STRINGS.NEWLINES,
      tokens: ["\u2581This", "\n\n", "\u2581is", "\n", "\u2581a", "\n", "\u2581test", "."],
      ids: [2, 1417, 109, 603, 108, 476, 108, 2121, 235265, 1],
      decoded: "<bos> This\n\n is\n a\n test.<eos>",
    },
    LEADING_SPACE: {
      text: BASE_TEST_STRINGS.LEADING_SPACE,
      tokens: ["\u2581", "\u2581", "\u2581leading", "\u2581space"],
      ids: [2, 235248, 235248, 8133, 3641, 1],
      decoded: "<bos>   leading space<eos>",
    },
    TRAILING_SPACE: {
      text: BASE_TEST_STRINGS.TRAILING_SPACE,
      tokens: ["\u2581trailing", "\u2581space", "\u2581", "\u2581", "\u2581"],
      ids: [2, 60732, 3641, 235248, 235248, 235248, 1],
      decoded: "<bos> trailing space   <eos>",
    },
    SURROUNDING_SPACE: {
      text: BASE_TEST_STRINGS.SURROUNDING_SPACE,
      tokens: ["\u2581", "\u2581", "\u2581surrounding", "\u2581space", "\u2581", "\u2581", "\u2581"],
      ids: [2, 235248, 235248, 16531, 3641, 235248, 235248, 235248, 1],
      decoded: "<bos>   surrounding space   <eos>",
    },
    DOUBLE_SPACE: {
      text: BASE_TEST_STRINGS.DOUBLE_SPACE,
      tokens: ["\u2581Hi", "\u2581", "\u2581Hello"],
      ids: [2, 11192, 235248, 25957, 1],
      decoded: "<bos> Hi  Hello<eos>",
    },
    SPIECE_UNDERSCORE: {
      text: BASE_TEST_STRINGS.SPIECE_UNDERSCORE,
      tokens: ["\u2581This", "\u2581", "\u2581is", "\u2581", "\u2581a", "\u2581", "\u2581test", "\u2581", "\u2581."],
      ids: [2, 1417, 235248, 603, 235248, 476, 235248, 2121, 235248, 954, 1],
      decoded: "<bos> This  is  a  test  .<eos>",
    },
    ONLY_WHITESPACE: {
      text: BASE_TEST_STRINGS.ONLY_WHITESPACE,
      tokens: ["\u2581", "\t", "\n"],
      ids: [2, 235248, 226, 108, 1],
      decoded: "<bos> \t\n<eos>",
    },
  },
};
