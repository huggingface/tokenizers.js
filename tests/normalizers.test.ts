import { Tokenizer } from "../src";

const make_tokenizer = (handle_chinese_chars = true) =>
  new Tokenizer(
    {
      version: "1.0",
      normalizer: {
        type: "BertNormalizer",
        clean_text: true,
        handle_chinese_chars,
        strip_accents: false,
        lowercase: true,
      },
      pre_tokenizer: { type: "BertPreTokenizer" },
      model: {
        type: "WordPiece",
        unk_token: "[UNK]",
        continuing_subword_prefix: "##",
        max_input_chars_per_word: 100,
        vocab: { "[UNK]": 0, "9": 1, x: 2, 一: 3 },
      },
      decoder: null,
      post_processor: null,
      added_tokens: [],
    },
    {},
  );

describe("BertNormalizer", () => {
  const tokenizer = make_tokenizer();

  it.each([0x3400, 0x4dbf, 0x4e00, 0x9fff, 0xf900, 0xfaff, 0x20000, 0x2000b, 0x2a6df, 0x2a700, 0x2b73f, 0x2b740, 0x2b81f, 0x2b820, 0x2ceaf, 0x2f800, 0x2fa1f])("adds spaces around CJK code point %i", (code_point) => {
    const char = String.fromCodePoint(code_point);
    expect(tokenizer.normalizer.normalize(`9${char}x`)).toBe(`9 ${char} x`);
  });

  it("preserves neighboring tokens around an unknown supplementary CJK character", () => {
    const encoded = tokenizer.encode("9\u{2000B}x");
    expect(encoded.tokens).toEqual(["9", "[UNK]", "x"]);
    expect(encoded.ids).toEqual([1, 0, 2]);
  });

  it("preserves BMP CJK tokenization", () => {
    expect(tokenizer.encode("9一x").tokens).toEqual(["9", "一", "x"]);
  });

  it("handles adjacent BMP and supplementary CJK characters", () => {
    expect(tokenizer.normalizer.normalize("9一\u{2000B}\u{2F800}x")).toBe("9 一  \u{2000B}  \u{2F800} x");
  });

  it.each([0x1f63a, 0x1ffff, 0x2a6e0, 0x2ceb0, 0x2f7ff, 0x2fa20])("leaves non-CJK supplementary code point %i unchanged", (code_point) => {
    const text = `9${String.fromCodePoint(code_point)}x`;
    expect(tokenizer.normalizer.normalize(text)).toBe(text);
    expect(tokenizer.encode(text).tokens).toEqual(["[UNK]"]);
  });

  it("does not split CJK characters when handle_chinese_chars is disabled", () => {
    const disabled = make_tokenizer(false);
    for (const text of ["9一x", "9\u{2000B}x"]) {
      expect(disabled.normalizer.normalize(text)).toBe(text);
      expect(disabled.encode(text).tokens).toEqual(["[UNK]"]);
    }
  });

  it("preserves empty input", () => {
    expect(tokenizer.normalizer.normalize("")).toBe("");
    expect(tokenizer.encode("").tokens).toEqual([]);
  });
});
