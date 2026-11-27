import { BASE_TEST_STRINGS } from "../../static/constants";
import { TestConfig } from "../../static/types";

const testConfig: TestConfig = {
  // - uses a Unigram model with `byte_fallback: true`
  "onnx-community/phonon-31m-en-ONNX": {
    SIMPLE: {
      text: BASE_TEST_STRINGS.SIMPLE,
      tokens: ["▁How", "▁are", "▁you", "▁doing", "?"],
      ids: [1061, 703, 669, 855, 691],
      decoded: "How are you doing?",
    },
    SIMPLE_WITH_PUNCTUATION: {
      text: BASE_TEST_STRINGS.SIMPLE_WITH_PUNCTUATION,
      tokens: ["▁You", "▁", "should", "'", "ve", "▁done", "▁this", "."],
      ids: [740, 660, 907, 664, 717, 1004, 688, 663],
      decoded: "You should've done this.",
    },
    TEXT_WITH_NUMBERS: {
      text: BASE_TEST_STRINGS.TEXT_WITH_NUMBERS,
      tokens: ["▁The", "▁c", "ompany", "▁was", "▁found", "ed", "▁in", "▁", "2", "0", "1", "6", "."],
      ids: [776, 723, 1408, 685, 1189, 678, 676, 660, 769, 720, 748, 978, 663],
      decoded: "The company was founded in 2016.",
    },
    CURRENCY_WITH_DECIMALS: {
      text: BASE_TEST_STRINGS.CURRENCY_WITH_DECIMALS,
      tokens: ["▁I", "▁", "bought", "▁an", "▁app", "le", "▁for", "▁$", "1", ".", "0", "0", "▁at", "▁the", "▁store", "."],
      ids: [666, 660, 2729, 758, 1670, 814, 683, 1403, 748, 663, 720, 720, 716, 665, 2202, 663],
      decoded: "I bought an apple for $1.00 at the store.",
    },
    CURRENCY: {
      text: BASE_TEST_STRINGS.CURRENCY,
      tokens: ["▁T", "est", "▁$", "1", "▁R", "2", "▁", "<0x23>", "3", "▁", "<0xE2>", "<0x82>", "<0xAC>", "4", "▁", "<0xC2>", "<0xA3>", "5", "▁", "<0xC2>", "<0xA5>", "6", "▁", "<0xE2>", "<0x82>", "<0xA3>", "7", "▁", "<0xE2>", "<0x82>", "<0xB9>", "8", "▁", "<0xE2>", "<0x82>", "<0xB1>", "9", "▁test", "."],
      ids: [1103, 974, 1403, 748, 1409, 769, 660, 439, 873, 660, 630, 534, 576, 924, 660, 598, 567, 856, 660, 598, 569, 978, 660, 630, 534, 567, 1003, 660, 630, 534, 589, 964, 660, 630, 534, 581, 905, 1606, 663],
      decoded: "Test $1 R2 #3 €4 £5 ¥6 ₣7 ₹8 ₱9 test.",
    },
    OUT_OF_VOCABULARY_SYMBOLS: {
      text: "€ £ ° + = # @",
      tokens: ["▁", "<0xE2>", "<0x82>", "<0xAC>", "▁", "<0xC2>", "<0xA3>", "▁", "<0xC2>", "<0xB0>", "▁", "<0x2B>", "▁", "<0x3D>", "▁", "<0x23>", "▁", "<0x40>"],
      ids: [660, 630, 534, 576, 660, 598, 567, 660, 598, 580, 660, 447, 660, 465, 660, 439, 660, 468],
      decoded: "€ £ ° + = # @",
    },
    OUT_OF_VOCABULARY_SYMBOLS_WITHOUT_SPACES: {
      text: "€£°+=#@",
      tokens: ["▁", "<0xE2>", "<0x82>", "<0xAC>", "<0xC2>", "<0xA3>", "<0xC2>", "<0xB0>", "<0x2B>", "<0x3D>", "<0x23>", "<0x40>"],
      ids: [660, 630, 534, 576, 598, 567, 598, 580, 447, 465, 439, 468],
      decoded: "€£°+=#@",
    },
    OUT_OF_VOCABULARY_SYMBOLS_IN_SENTENCE: {
      text: "It costs €5, £4 or 20° + 3 = 23 #tag @user.",
      tokens: ["▁It", "▁cost", "s", "▁", "<0xE2>", "<0x82>", "<0xAC>", "5", ",", "▁", "<0xC2>", "<0xA3>", "4", "▁or", "▁", "2", "0", "<0xC2>", "<0xB0>", "▁", "<0x2B>", "▁", "3", "▁", "<0x3D>", "▁", "2", "3", "▁", "<0x23>", "t", "ag", "▁", "<0x40>", "us", "er", "."],
      ids: [735, 1999, 662, 660, 630, 534, 576, 856, 661, 660, 598, 567, 924, 711, 660, 769, 720, 598, 580, 660, 447, 660, 873, 660, 465, 660, 769, 873, 660, 439, 674, 1325, 660, 468, 1010, 707, 663],
      decoded: "It costs €5, £4 or 20° + 3 = 23 #tag @user.",
    },
    OUT_OF_VOCABULARY_LETTERS: {
      text: "naïve 寿司が好き",
      tokens: ["▁Na", "<0xC3>", "<0xAF>", "ve", "▁", "<0xE5>", "<0xAF>", "<0xBF>", "<0xE5>", "<0x8F>", "<0xB8>", "<0xE3>", "<0x81>", "<0x8C>", "<0xE5>", "<0xA5>", "<0xBD>", "<0xE3>", "<0x81>", "<0x8D>", "."],
      ids: [1560, 599, 579, 717, 660, 633, 579, 595, 633, 547, 588, 631, 533, 544, 633, 569, 593, 631, 533, 545, 663],
      decoded: "Naïve 寿司が好き.",
    },
    AUDIO_MARKERS: {
      text: "<|audio_bos|>Hello €<|audio_prompt|><|audio_latent|>",
      tokens: ["<|audio_bos|>", "▁Hello", "▁", "<0xE2>", "<0x82>", "<0xAC>", "<|audio_prompt|>", "<|audio_latent|>"],
      ids: [4, 3248, 660, 630, 534, 576, 5, 6],
      decoded: "<|audio_bos|> Hello €<|audio_prompt|><|audio_latent|>",
    },
  },
};

export default testConfig;
