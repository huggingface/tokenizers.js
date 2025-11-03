import fetchConfigById from "../../utils/fetchConfigById";
import { Tokenizer } from "../../../src";

describe("hard-coded", () => {
  const TESTS: Record<
    string,
    Array<{
      data: Record<string, Array<number>>;
      reversible: boolean;
    }>
  > = {
    // legacy=false
    "Xenova/t5-tokenizer-new": [
      {
        data: {
          // https://github.com/huggingface/transformers/pull/26678
          // ['▁Hey', '▁', '</s>', '.', '▁how', '▁are', '▁you']
          "Hey </s>. how are you": [9459, 3, 1, 5, 149, 33, 25],
        },
        reversible: true,
      },
      {
        data: {
          "</s>\n": [1, 3],
          "A\n'll": [71, 3, 31, 195],
        },
        reversible: false,
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
