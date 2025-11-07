import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer, AddedToken } from "../src";
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

describe("Tokenizer methods", () => {
  // Create a simple BPE tokenizer for testing
  // Vocab size: 10 tokens
  // - 3 special tokens: <s>, </s>, <pad>
  // - 1 unk token: <unk>
  // - 5 regular tokens: a, b, c, ab, bc
  // - 1 non-special added token: "<added>"
  const unk_token = "<unk>";
  const bos_token = "<s>";
  const eos_token = "</s>";
  const pad_token = "<pad>";
  const added_token = "<added>";

  const added_tokens = [
    new AddedToken({
      id: 0,
      content: unk_token,
      special: true,
    }),
    new AddedToken({
      id: 1,
      content: bos_token,
      special: true,
    }),
    new AddedToken({
      id: 2,
      content: eos_token,
      special: true,
    }),
    new AddedToken({
      id: 3,
      content: pad_token,
      special: true,
    }),
    new AddedToken({
      id: 9,
      content: added_token,
      special: false, // regular added token
    }),
  ];

  const tokenizerJson = {
    version: "1.0",
    truncation: null,
    padding: null,
    added_tokens,
    normalizer: null,
    pre_tokenizer: null,
    post_processor: null,
    decoder: null,
    model: {
      type: "BPE",
      dropout: null,
      unk_token,
      continuing_subword_prefix: null,
      end_of_word_suffix: null,
      fuse_unk: false,
      byte_fallback: false,
      ignore_merges: false,
      vocab: {
        [unk_token]: 0,
        [bos_token]: 1,
        [eos_token]: 2,
        [pad_token]: 3,
        a: 4,
        b: 5,
        c: 6,
        ab: 7,
        bc: 8,
      },
      merges: [
        ["a", "b"],
        ["b", "c"],
      ],
    },
  } as any;

  const tokenizerConfig = {
    add_bos_token: false,
    add_prefix_space: false,
    added_tokens_decoder: Object.fromEntries(added_tokens.map((token) => [String(token.id), { id: token.id, content: token.content, special: token.special }])),
    bos_token,
    clean_up_tokenization_spaces: false,
    eos_token,
    legacy: true,
    model_max_length: 1000000000000000,
    pad_token,
    sp_model_kwargs: {},
    spaces_between_special_tokens: false,
    tokenizer_class: "LlamaTokenizer",
    unk_token,
  };

  let tokenizer: Tokenizer;

  beforeAll(() => {
    tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  });

  describe("token_to_id", () => {
    test("should return correct ID for regular token", () => {
      expect(tokenizer.token_to_id("a")).toBe(4);
      expect(tokenizer.token_to_id("b")).toBe(5);
      expect(tokenizer.token_to_id("c")).toBe(6);
    });

    test("should return correct ID for merged token", () => {
      expect(tokenizer.token_to_id("ab")).toBe(7);
      expect(tokenizer.token_to_id("bc")).toBe(8);
    });

    test("should return correct ID for special tokens", () => {
      expect(tokenizer.token_to_id(unk_token)).toBe(0);
      expect(tokenizer.token_to_id(bos_token)).toBe(1);
      expect(tokenizer.token_to_id(eos_token)).toBe(2);
      expect(tokenizer.token_to_id(pad_token)).toBe(3);
      expect(tokenizer.token_to_id(added_token)).toBe(9);
    });

    test("should return undefined for non-existing token", () => {
      expect(tokenizer.token_to_id("xyz")).toBeUndefined();
    });
  });

  describe("id_to_token", () => {
    test("should return correct token for regular token ID", () => {
      expect(tokenizer.id_to_token(4)).toBe("a");
      expect(tokenizer.id_to_token(5)).toBe("b");
      expect(tokenizer.id_to_token(6)).toBe("c");
    });

    test("should return correct token for merged token ID", () => {
      expect(tokenizer.id_to_token(7)).toBe("ab");
      expect(tokenizer.id_to_token(8)).toBe("bc");
    });

    test("should return correct token for special/added token ID", () => {
      expect(tokenizer.id_to_token(0)).toBe(unk_token);
      expect(tokenizer.id_to_token(1)).toBe(bos_token);
      expect(tokenizer.id_to_token(2)).toBe(eos_token);
      expect(tokenizer.id_to_token(3)).toBe(pad_token);
      expect(tokenizer.id_to_token(9)).toBe(added_token);
    });

    test("should return undefined for non-existing ID", () => {
      expect(tokenizer.id_to_token(999)).toBeUndefined();
    });
  });

  describe("get_added_tokens_decoder", () => {
    test("should return a Map", () => {
      const decoder = tokenizer.get_added_tokens_decoder();
      expect(decoder).toBeInstanceOf(Map);
    });

    test("should contain all special tokens", () => {
      const decoder = tokenizer.get_added_tokens_decoder();
      expect(decoder.size).toBe(5);
      expect(decoder.has(0)).toBe(true);
      expect(decoder.has(1)).toBe(true);
      expect(decoder.has(2)).toBe(true);
      expect(decoder.has(3)).toBe(true);
      expect(decoder.has(9)).toBe(true);
    });

    test("should return AddedToken objects with correct properties", () => {
      const decoder = tokenizer.get_added_tokens_decoder();
      const unkToken = decoder.get(0);
      expect(unkToken).toBeDefined();
      expect(unkToken?.content).toBe(unk_token);
      expect(unkToken?.special).toBe(true);
      expect(unkToken).toBeInstanceOf(AddedToken);

      const bosToken = decoder.get(1);
      expect(bosToken?.content).toBe(bos_token);
      expect(bosToken?.special).toBe(true);
    });

    test("should not contain regular tokens", () => {
      const decoder = tokenizer.get_added_tokens_decoder();
      expect(decoder.has(4)).toBe(false);
      expect(decoder.has(5)).toBe(false);
      expect(decoder.has(6)).toBe(false);
    });
  });

  describe("roundtrip conversions", () => {
    test("token_to_id and id_to_token should be inverse operations", () => {
      const tokens = [unk_token, bos_token, eos_token, pad_token, "a", "b", "c", "ab", "bc", added_token];

      for (const token of tokens) {
        const id = tokenizer.token_to_id(token);
        expect(id).toBeDefined();
        const tokenBack = tokenizer.id_to_token(id!);
        expect(tokenBack).toBe(token);
      }
    });
  });
});
