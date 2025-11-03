import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer } from "../src";
import collectTests from "./utils/collectTests";

const TOKENIZER_TESTS = await collectTests();

describe("Tokenizers (model-specific)", () => {
  for (const [tokenizerName, config] of TOKENIZER_TESTS) {
    describe(tokenizerName, () => {
      const modelIds = Object.keys(config.default);
      for (const modelId of modelIds) {
        describe(modelId, () => {
          let tokenizer: Tokenizer;

          beforeAll(async () => {
            const { tokenizerJson, tokenizerConfig } = await fetchConfigById(modelId);
            tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
          });

          for (const [testName, testCase] of Object.entries(config.default[modelId])) {
            test(testName, () => {
              if (testCase.ids) {
                const encoded = tokenizer.encode(testCase.text, {
                  text_pair: testCase.text_pair,
                });
                expect(encoded.ids).toEqual(testCase.ids);

                if (testCase.decoded) {
                  const decoded = tokenizer.decode(testCase.ids);
                  expect(decoded).toEqual(testCase.decoded);
                }
              }
              if (testCase.tokens) {
                const tokens = tokenizer.tokenize(testCase.text, {
                  text_pair: testCase.text_pair,
                });
                expect(tokens).toEqual(testCase.tokens);
              }
            });
          }
        });
      }
    });
  }
});
