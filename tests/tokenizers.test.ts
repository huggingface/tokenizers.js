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
  const normalized_special_token = "<normalized_special>";
  const unnormalized_special_token = "<unnormalized_special>";

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
      id: 10,
      content: added_token,
      special: false, // regular added token
    }),
    new AddedToken({
      id: 11,
      content: normalized_special_token,
      special: true,
      normalized: true,
    }),
    new AddedToken({
      id: 12,
      content: unnormalized_special_token,
      special: true,
      normalized: false,
    }),
  ];

  const tokenizerJson = {
    version: "1.0",
    truncation: null,
    padding: null,
    added_tokens,
    normalizer: {
      type: "Prepend",
      prepend: " ",
    },
    // normalizer: null,
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
        " ": 4,
        a: 5,
        b: 6,
        c: 7,
        ab: 8,
        bc: 9,
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
      expect(tokenizer.token_to_id(" ")).toBe(4);
      expect(tokenizer.token_to_id("a")).toBe(5);
      expect(tokenizer.token_to_id("b")).toBe(6);
      expect(tokenizer.token_to_id("c")).toBe(7);
    });

    test("should return correct ID for merged token", () => {
      expect(tokenizer.token_to_id("ab")).toBe(8);
      expect(tokenizer.token_to_id("bc")).toBe(9);
    });

    test("should return correct ID for special tokens", () => {
      expect(tokenizer.token_to_id(unk_token)).toBe(0);
      expect(tokenizer.token_to_id(bos_token)).toBe(1);
      expect(tokenizer.token_to_id(eos_token)).toBe(2);
      expect(tokenizer.token_to_id(pad_token)).toBe(3);
      expect(tokenizer.token_to_id(added_token)).toBe(10);
      expect(tokenizer.token_to_id(normalized_special_token)).toBe(11);
      expect(tokenizer.token_to_id(unnormalized_special_token)).toBe(12);
    });

    test("should return undefined for non-existing token", () => {
      expect(tokenizer.token_to_id("xyz")).toBeUndefined();
    });
  });

  describe("id_to_token", () => {
    test("should return correct token for regular token ID", () => {
      expect(tokenizer.id_to_token(4)).toBe(" ");
      expect(tokenizer.id_to_token(5)).toBe("a");
      expect(tokenizer.id_to_token(6)).toBe("b");
      expect(tokenizer.id_to_token(7)).toBe("c");
    });

    test("should return correct token for merged token ID", () => {
      expect(tokenizer.id_to_token(8)).toBe("ab");
      expect(tokenizer.id_to_token(9)).toBe("bc");
    });

    test("should return correct token for special/added token ID", () => {
      expect(tokenizer.id_to_token(0)).toBe(unk_token);
      expect(tokenizer.id_to_token(1)).toBe(bos_token);
      expect(tokenizer.id_to_token(2)).toBe(eos_token);
      expect(tokenizer.id_to_token(3)).toBe(pad_token);
      expect(tokenizer.id_to_token(10)).toBe(added_token);
      expect(tokenizer.id_to_token(11)).toBe(normalized_special_token);
      expect(tokenizer.id_to_token(12)).toBe(unnormalized_special_token);
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
      expect(decoder.size).toBe(7);
      expect(decoder.has(0)).toBe(true);
      expect(decoder.has(1)).toBe(true);
      expect(decoder.has(2)).toBe(true);
      expect(decoder.has(3)).toBe(true);
      expect(decoder.has(10)).toBe(true);
      expect(decoder.has(11)).toBe(true);
      expect(decoder.has(12)).toBe(true);
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
      expect(decoder.has(7)).toBe(false);
    });
  });

  describe("roundtrip conversions", () => {
    test("token_to_id and id_to_token should be inverse operations", () => {
      const tokens = [unk_token, bos_token, eos_token, pad_token, " ", "a", "b", "c", "ab", "bc", added_token, normalized_special_token, unnormalized_special_token];

      for (const token of tokens) {
        const id = tokenizer.token_to_id(token);
        expect(id).toBeDefined();
        const tokenBack = tokenizer.id_to_token(id!);
        expect(tokenBack).toBe(token);
      }
    });
  });

  describe("get_vocab", () => {
    test("should return full vocabulary including added tokens", () => {
      const vocab = tokenizer.get_vocab(true);
      expect(vocab.size).toBe(13);
    });
    test("should return vocabulary excluding added tokens", () => {
      const vocab = tokenizer.get_vocab(false);
      expect(vocab.size).toBe(13 - added_tokens.length); // NOTE: Rust library returns 10
    });

    test("should tokenize string correctly", () => {
      const text = `${bos_token}abc ${added_token} ${normalized_special_token} ${unnormalized_special_token} xyz${eos_token}`;
      const encoded = tokenizer.encode(text);

      expect(encoded).toEqual({
        ids: [1, 8, 7, 10, 11, 4, 12, 4, 4, 0, 0, 0, 0, 0, 0, 0],
        tokens: [" <s>", "ab", "c", " <added>", " <normalized_special>", " ", "<unnormalized_special>", " ", " ", "<unk>", "<unk>", "<unk>", "<unk>", "<unk>", "<unk>", "<unk>"],
        attention_mask: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      });
      throw new Error(JSON.stringify(text) + "||" + JSON.stringify(encoded));
    });
  });
});
