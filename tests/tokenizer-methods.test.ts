import { Tokenizer, AddedToken } from "../src";

describe("Tokenizer methods", () => {
  // Create a simple BPE tokenizer for testing
  // Vocab size: 9 tokens
  // - 3 special tokens: <s>, </s>, <pad>
  // - 1 unk token: <unk>
  // - 5 regular tokens: a, b, c, ab, bc
  const tokenizerJson = {
    version: "1.0",
    truncation: null as any,
    padding: null as any,
    added_tokens: [
      { id: 0, content: "<unk>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
      { id: 1, content: "<s>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
      { id: 2, content: "</s>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
      { id: 3, content: "<pad>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
    ],
    normalizer: null as any,
    pre_tokenizer: null as any,
    post_processor: null as any,
    decoder: null as any,
    model: {
      type: "BPE",
      dropout: null as any,
      unk_token: "<unk>",
      continuing_subword_prefix: null as any,
      end_of_word_suffix: null as any,
      fuse_unk: false,
      byte_fallback: false,
      ignore_merges: false,
      vocab: {
        "<unk>": 0,
        "<s>": 1,
        "</s>": 2,
        "<pad>": 3,
        "a": 4,
        "b": 5,
        "c": 6,
        "ab": 7,
        "bc": 8,
      },
      merges: [
        ["a", "b"],
        ["b", "c"],
      ] as any[],
    },
  };

  const tokenizerConfig = {
    add_bos_token: false,
    add_prefix_space: false,
    added_tokens_decoder: {
      "0": { id: 0, content: "<unk>", special: true },
      "1": { id: 1, content: "<s>", special: true },
      "2": { id: 2, content: "</s>", special: true },
      "3": { id: 3, content: "<pad>", special: true },
    },
    bos_token: "<s>",
    clean_up_tokenization_spaces: false,
    eos_token: "</s>",
    legacy: true,
    model_max_length: 1000000000000000,
    pad_token: "<pad>",
    sp_model_kwargs: {},
    spaces_between_special_tokens: false,
    tokenizer_class: "LlamaTokenizer",
    unk_token: "<unk>",
    use_default_system_prompt: false,
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
      expect(tokenizer.token_to_id("<unk>")).toBe(0);
      expect(tokenizer.token_to_id("<s>")).toBe(1);
      expect(tokenizer.token_to_id("</s>")).toBe(2);
      expect(tokenizer.token_to_id("<pad>")).toBe(3);
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

    test("should return correct token for special token ID", () => {
      expect(tokenizer.id_to_token(0)).toBe("<unk>");
      expect(tokenizer.id_to_token(1)).toBe("<s>");
      expect(tokenizer.id_to_token(2)).toBe("</s>");
      expect(tokenizer.id_to_token(3)).toBe("<pad>");
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
      expect(decoder.size).toBe(4);
      expect(decoder.has(0)).toBe(true);
      expect(decoder.has(1)).toBe(true);
      expect(decoder.has(2)).toBe(true);
      expect(decoder.has(3)).toBe(true);
    });

    test("should return AddedToken objects with correct properties", () => {
      const decoder = tokenizer.get_added_tokens_decoder();
      
      const unkToken = decoder.get(0);
      expect(unkToken).toBeDefined();
      expect(unkToken?.content).toBe("<unk>");
      expect(unkToken?.special).toBe(true);
      expect(unkToken).toBeInstanceOf(AddedToken);

      const bosToken = decoder.get(1);
      expect(bosToken?.content).toBe("<s>");
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
      const tokens = ["a", "b", "c", "ab", "bc", "<unk>", "<s>", "</s>", "<pad>"];
      
      for (const token of tokens) {
        const id = tokenizer.token_to_id(token);
        expect(id).toBeDefined();
        const tokenBack = tokenizer.id_to_token(id!);
        expect(tokenBack).toBe(token);
      }
    });
  });
});
