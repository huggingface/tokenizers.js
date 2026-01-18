import { Tokenizer } from "../../../src";
import fetchConfigById from "../../utils/fetchConfigById";

describe("hard-coded", () => {
  const TESTS: Record<
    string,
    Array<{
      data: Array<{
        text: string;
        text_pair?: string;
        ids: Array<number>;
        decoded?: string;
      }>;
      reversible?: boolean;
    }>
  > = {
    // Test normalized=true special tokens
    "Xenova/llama-tokenizer": [
      {
        data: [
          {
            text: "<s>\n",
            ids: [1, 13],
          },
          {
            text: " <s>",
            ids: [29871, 1],
          },
        ],
      },
    ],
    // Text-pair
    "Xenova/llama3-tokenizer-new": [
      {
        data: [
          {
            text: "hello",
            text_pair: "world",
            ids: [15339, 14957],
            decoded: "helloworld",
          },
        ],
      },
    ],
    // new serialization format (tokenizers >= 0.20.0)
    // BPE merges are now [string, string][] instead of string[]
    "Xenova/Llama-3.2-Tokenizer": [
      {
        data: [
          {
            text: "hello world",
            ids: [15339, 1917],
          },
          {
            text: " belirtilen",
            ids: [120909],
          }
        ],
        reversible: true,
      },
    ],
    "Xenova/Llama-3.2-Tokenizer_no_ignore_merges": [
      // Test ignore_merges=false
      {
        data: [
          {
            text: "hello world",
            ids: [15339, 1917],
          },
          {
            text: " belirtilen",
            ids: [101664, 1678, 268],
          }
        ],
        reversible: true,
      },
    ],
  };

  for (const [tokenizerName, test_data] of Object.entries(TESTS)) {
    it(
      tokenizerName,
      async () => {
        for (const { data, reversible } of test_data) {
          const { tokenizerJson, tokenizerConfig } = await fetchConfigById(tokenizerName);
          const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

          for (const { text, text_pair, ids: expected, decoded } of data) {
            const encoded = tokenizer.encode(text, { add_special_tokens: false, text_pair });
            expect(encoded.ids).toEqual(expected);

            // If reversible, test that decoding produces the original text
            if (decoded || reversible) {
              expect(tokenizer.decode(encoded.ids)).toEqual(decoded || text);
            }
          }
        }
      },
      10_000,
    );
  }
});
