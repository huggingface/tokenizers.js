import { Tokenizer } from "../src";

// Python `tokenizers` lowercases one character at a time, so a capital sigma
// always becomes "σ" (U+03C3), never the final form "ς" (U+03C2).
const make_tokenizer = (normalizer: object) =>
  new Tokenizer(
    {
      version: "1.0",
      normalizer,
      pre_tokenizer: { type: "WhitespaceSplit" },
      model: {
        type: "WordPiece",
        unk_token: "[UNK]",
        continuing_subword_prefix: "##",
        max_input_chars_per_word: 100,
        vocab: { "[UNK]": 0, οδοσ: 1, οδος: 2, σ: 3 },
      },
      decoder: null,
      post_processor: null,
      added_tokens: [],
    } as any,
    {},
  );

describe("Lowercasing capital sigma", () => {
  const normalizers = {
    BertNormalizer: {
      type: "BertNormalizer",
      clean_text: true,
      handle_chinese_chars: true,
      strip_accents: false,
      lowercase: true,
    },
    Lowercase: { type: "Lowercase" },
  };

  for (const [name, config] of Object.entries(normalizers)) {
    it(`${name} gives "σ" for a word-final "Σ"`, () => {
      const tokenizer = make_tokenizer(config);
      expect(tokenizer.normalizer!.normalize("ΟΔΟΣ")).toBe("οδοσ");
      expect(tokenizer.normalizer!.normalize("ΑΣ.")).toBe("ασ.");
      expect(tokenizer.encode("ΟΔΟΣ").ids).toEqual([1]);
    });

    it(`${name} leaves an explicit final sigma alone`, () => {
      const tokenizer = make_tokenizer(config);
      expect(tokenizer.normalizer!.normalize("οδος")).toBe("οδος");
      expect(tokenizer.encode("οδος").ids).toEqual([2]);
    });
  }
});
