import { WhitespacePreTokenizer } from "../src";

// Expected values below were produced by the Python `tokenizers` 0.23.2 package
// (`pre_tokenizers.Whitespace().pre_tokenize_str(text)`), not by this implementation.
describe("Whitespace pre-tokenizer", () => {
  const pre_tokenizer = new WhitespacePreTokenizer();

  const cases: [string, string, string[]][] = [
    ["ASCII words and punctuation", "Hello, world! x_y", ["Hello", ",", "world", "!", "x_y"]],
    ["Latin-1 accents", "héllo wörld", ["héllo", "wörld"]],
    ["accents followed by punctuation", "naïve café!", ["naïve", "café", "!"]],
    ["Cyrillic", "привет, мир", ["привет", ",", "мир"]],
    ["Hebrew", "שלום עולם", ["שלום", "עולם"]],
    ["CJK without spaces", "日本語のテキスト", ["日本語のテキスト"]],
    ["Arabic letters and Arabic-Indic digits", "ا١٢٣ب", ["ا١٢٣ب"]],
    ["combining marks (Mn)", "école", ["école"]],
    ["zero width joiner (Join_Control)", "ab‍cd", ["ab‍cd"]],
    ["connector punctuation (Pc)", "x‿y", ["x‿y"]],
    ["superscript digit is not a word character", "foo²bar", ["foo", "²", "bar"]],
    ["Unicode whitespace (NBSP, ideographic space)", "a b　c", ["a", "b", "c"]],
    ["U+FEFF is not whitespace", "a﻿b", ["a", "﻿", "b"]],
    ["roman numeral (Nl) is a word character, circled digit is not", "ⅷ ①", ["ⅷ", "①"]],
    ["emoji are punctuation-like runs", "😀 hi 🎉", ["😀", "hi", "🎉"]],
    ["whitespace only", "  ", []],
    ["empty string", "", []],
  ];

  it.each(cases)("matches Python tokenizers: %s", (_name, text, expected) => {
    expect(pre_tokenizer.pre_tokenize_text(text)).toEqual(expected);
  });
});
