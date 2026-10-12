import { DigitsPreTokenizer } from "../src";

// Expected values below were produced by the Python `tokenizers` 0.23.2 package
// (`pre_tokenizers.Digits(individual_digits=...).pre_tokenize_str(text)`), not by this implementation.
// The Rust implementation splits on `char::is_numeric` (Unicode categories Nd, Nl and No).
type Case = [name: string, text: string, expected: string[]];

describe("Digits pre-tokenizer", () => {
  describe("individual_digits: true", () => {
    const pre_tokenizer = new DigitsPreTokenizer({ type: "Digits", individual_digits: true });
    const cases: Case[] = [
      ["ASCII digits mixed with letters", "12a3", ["1", "2", "a", "3"]],
      ["ASCII digits inside a word", "abc123def", ["abc", "1", "2", "3", "def"]],
      ["Arabic-Indic digits", "\u0661\u0662\u0663", ["\u0661", "\u0662", "\u0663"]],
      ["single Arabic-Indic digit between letters", "a\u0662b", ["a", "\u0662", "b"]],
      ["Extended Arabic-Indic digits", "\u06f1\u06f2 x \u06f3", ["\u06f1", "\u06f2", " x ", "\u06f3"]],
      ["Devanagari digits", "\u0967\u0968\u0969", ["\u0967", "\u0968", "\u0969"]],
      ["fullwidth digits", "\uff11\uff12", ["\uff11", "\uff12"]],
      ["superscript two and circled one (category No)", "a\u00b2b\u2460", ["a", "\u00b2", "b", "\u2460"]],
      ["vulgar fractions (No)", "\u00bd\u00bc", ["\u00bd", "\u00bc"]],
      ["Roman numeral (Nl) and ASCII letters", "\u2167 VIII", ["\u2167", " VIII"]],
      ["ideographic number zero and Hangzhou numeral (Nl)", "\u3007\u3021", ["\u3007", "\u3021"]],
      ["mathematical bold digits (astral Nd)", "\ud835\udfcf\ud835\udfd0", ["\ud835\udfcf", "\ud835\udfd0"]],
      ["Thai digits", "\u0e51\u0e52", ["\u0e51", "\u0e52"]],
      ["no digits", "no digits", ["no digits"]],
      ["empty string", "", []],
      ["Arabic-Indic digits followed by ASCII digits", "\u0661\u0662 12", ["\u0661", "\u0662", " ", "1", "2"]],
    ];

    it.each(cases)("matches Python tokenizers: %s", (_name, text, expected) => {
      expect(pre_tokenizer.pre_tokenize_text(text)).toEqual(expected);
    });
  });

  describe("individual_digits: false", () => {
    const pre_tokenizer = new DigitsPreTokenizer({ type: "Digits", individual_digits: false });
    const cases: Case[] = [
      ["ASCII digits mixed with letters", "12a3", ["12", "a", "3"]],
      ["ASCII digits inside a word", "abc123def", ["abc", "123", "def"]],
      ["Arabic-Indic digits", "\u0661\u0662\u0663", ["\u0661\u0662\u0663"]],
      ["single Arabic-Indic digit between letters", "a\u0662b", ["a", "\u0662", "b"]],
      ["Extended Arabic-Indic digits", "\u06f1\u06f2 x \u06f3", ["\u06f1\u06f2", " x ", "\u06f3"]],
      ["Devanagari digits", "\u0967\u0968\u0969", ["\u0967\u0968\u0969"]],
      ["fullwidth digits", "\uff11\uff12", ["\uff11\uff12"]],
      ["superscript two and circled one (category No)", "a\u00b2b\u2460", ["a", "\u00b2", "b", "\u2460"]],
      ["vulgar fractions (No)", "\u00bd\u00bc", ["\u00bd\u00bc"]],
      ["Roman numeral (Nl) and ASCII letters", "\u2167 VIII", ["\u2167", " VIII"]],
      ["ideographic number zero and Hangzhou numeral (Nl)", "\u3007\u3021", ["\u3007\u3021"]],
      ["mathematical bold digits (astral Nd)", "\ud835\udfcf\ud835\udfd0", ["\ud835\udfcf\ud835\udfd0"]],
      ["Thai digits", "\u0e51\u0e52", ["\u0e51\u0e52"]],
      ["no digits", "no digits", ["no digits"]],
      ["empty string", "", []],
      ["Arabic-Indic digits followed by ASCII digits", "\u0661\u0662 12", ["\u0661\u0662", " ", "12"]],
    ];

    it.each(cases)("matches Python tokenizers: %s", (_name, text, expected) => {
      expect(pre_tokenizer.pre_tokenize_text(text)).toEqual(expected);
    });
  });
});
