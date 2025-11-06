import { Tokenizer, AddedToken } from "../src";

describe("Tokenizer methods - API validation", () => {
  describe("Method signatures", () => {
    // Create a minimal tokenizer config for testing
    const minimalTokenizerJson = {
      version: "1.0",
      truncation: null as any,
      padding: null as any,
      added_tokens: [
        {
          id: 50256,
          content: "<|endoftext|>",
          single_word: false,
          lstrip: false,
          rstrip: false,
          normalized: false,
          special: true,
        },
      ],
      normalizer: null as any,
      pre_tokenizer: null as any,
      post_processor: null as any,
      decoder: null as any,
      model: {
        type: "BPE",
        dropout: null as any,
        unk_token: null as any,
        continuing_subword_prefix: null as any,
        end_of_word_suffix: null as any,
        fuse_unk: false,
        byte_fallback: false,
        ignore_merges: false,
        vocab: {
          hello: 31373,
          world: 995,
          "<|endoftext|>": 50256,
        },
        merges: [] as any[],
      },
    };

    const minimalTokenizerConfig = {
      add_bos_token: false,
      add_prefix_space: false,
      added_tokens_decoder: {},
      bos_token: null as any,
      clean_up_tokenization_spaces: true,
      eos_token: null as any,
      model_max_length: 1000000000000000,
      pad_token: null as any,
      sp_model_kwargs: {},
      spaces_between_special_tokens: false,
      tokenizer_class: "GPT2Tokenizer",
      unk_token: null as any,
      use_default_system_prompt: false,
    };

    let tokenizer: Tokenizer;

    beforeAll(() => {
      tokenizer = new Tokenizer(minimalTokenizerJson, minimalTokenizerConfig);
    });

    describe("token_to_id", () => {
      test("should be a function", () => {
        expect(typeof tokenizer.token_to_id).toBe("function");
      });

      test("should return correct ID for existing token", () => {
        const id = tokenizer.token_to_id("hello");
        expect(id).toBe(31373);
      });

      test("should return correct ID for special token", () => {
        const id = tokenizer.token_to_id("<|endoftext|>");
        expect(id).toBe(50256);
      });

      test("should return undefined for non-existing token", () => {
        const id = tokenizer.token_to_id("nonexistenttoken12345");
        expect(id).toBeUndefined();
      });

      test("should return correct ID for world token", () => {
        const id = tokenizer.token_to_id("world");
        expect(id).toBe(995);
      });
    });

    describe("id_to_token", () => {
      test("should be a function", () => {
        expect(typeof tokenizer.id_to_token).toBe("function");
      });

      test("should return correct token for existing ID", () => {
        const token = tokenizer.id_to_token(31373);
        expect(token).toBe("hello");
      });

      test("should return correct token for special token ID", () => {
        const token = tokenizer.id_to_token(50256);
        expect(token).toBe("<|endoftext|>");
      });

      test("should return undefined for non-existing ID", () => {
        const token = tokenizer.id_to_token(999999);
        expect(token).toBeUndefined();
      });

      test("should return correct token for world ID", () => {
        const token = tokenizer.id_to_token(995);
        expect(token).toBe("world");
      });
    });

    describe("get_added_tokens_decoder", () => {
      test("should be a function", () => {
        expect(typeof tokenizer.get_added_tokens_decoder).toBe("function");
      });

      test("should return a Map", () => {
        const decoder = tokenizer.get_added_tokens_decoder();
        expect(decoder).toBeInstanceOf(Map);
      });

      test("should contain special token", () => {
        const decoder = tokenizer.get_added_tokens_decoder();
        expect(decoder.has(50256)).toBe(true);

        const addedToken = decoder.get(50256);
        expect(addedToken).toBeDefined();
        expect(addedToken?.content).toBe("<|endoftext|>");
        expect(addedToken?.special).toBe(true);
      });

      test("should return AddedToken objects with correct properties", () => {
        const decoder = tokenizer.get_added_tokens_decoder();
        const addedToken = decoder.get(50256);

        expect(addedToken).toHaveProperty("content");
        expect(addedToken).toHaveProperty("id");
        expect(addedToken).toHaveProperty("special");
        expect(addedToken).toHaveProperty("lstrip");
        expect(addedToken).toHaveProperty("rstrip");
        expect(addedToken).toHaveProperty("single_word");
        expect(addedToken).toHaveProperty("normalized");
      });

      test("should return AddedToken instances", () => {
        const decoder = tokenizer.get_added_tokens_decoder();
        const addedToken = decoder.get(50256);
        expect(addedToken).toBeInstanceOf(AddedToken);
      });

      test("roundtrip: token_to_id and id_to_token should be inverse operations", () => {
        const token = "hello";
        const id = tokenizer.token_to_id(token);
        expect(id).toBeDefined();

        const tokenBack = tokenizer.id_to_token(id!);
        expect(tokenBack).toBe(token);
      });
    });
  });
});
