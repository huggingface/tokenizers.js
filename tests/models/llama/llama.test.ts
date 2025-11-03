import { Tokenizer } from "../../../src";
import fetchConfigById from "../../utils/fetchConfigById";

describe("hard-coded", () => {
  const TESTS: Record<
    string,
    Array<{
      data: Record<string, Array<number>>;
      reversible?: boolean;
    }>
  > = {
    // Test legacy compatibility
    "Xenova/llama-tokenizer": [
      {
        data: {
          "<s>\n": [1, 29871, 13],
        },
      },
    ],
    // new serialization format (tokenizers >= 0.20.0)
    // BPE merges are now [string, string][] instead of string[]
    "Xenova/Llama-3.2-Tokenizer": [
      {
        data: {
          "hello world": [15339, 1917],
          " belirtilen": [120909],
        },
        reversible: true,
      },
    ],
    "Xenova/Llama-3.2-Tokenizer_no_ignore_merges": [
      // Test ignore_merges=false
      {
        data: {
          "hello world": [15339, 1917],
          " belirtilen": [101664, 1678, 268],
        },
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

          for (const [text, expected] of Object.entries(data)) {
            const encoded = tokenizer.encode(text, {
              add_special_tokens: false,
            });
            expect(encoded.ids).toEqual(expected);

            // If reversible, test that decoding produces the original text
            if (reversible) {
              const decoded = tokenizer.decode(encoded.ids);
              expect(decoded).toEqual(text);
            }
          }
        }
      },
      10_000,
    );
  }
});
