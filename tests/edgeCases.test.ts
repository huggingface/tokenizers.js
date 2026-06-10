import { jest } from "@jest/globals";
import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer } from "../src";
import { create_pattern } from "../src/utils/core";
import { HUB_REGEX_PATTERNS } from "./fixtures/hubRegexPatterns";

describe("Edge cases", () => {
  it("should not take too long", async () => {
    const modelId = "Xenova/all-MiniLM-L6-v2";
    const { tokenizerJson, tokenizerConfig } = await fetchConfigById(modelId);
    const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

    let text = String.prototype.repeat.call("a", 50000);
    let { ids } = tokenizer.encode(text);
    expect(ids).toEqual([101, 100, 102]);
  }, 5000); // NOTE: 5 seconds

  it("Special/added tokens with earlier partial matches", async () => {
    const modelId = "Xenova/gemini-nano";
    const { tokenizerJson, tokenizerConfig } = await fetchConfigById(modelId);
    const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
    {
      let { ids } = tokenizer.encode("\n", { add_special_tokens: false });
      expect(ids).toEqual([108]);
    }
    {
      let { ids } = tokenizer.encode("\n\n", { add_special_tokens: false });
      expect(ids).toEqual([109]); // Should not be [108, 108]
    }
  }, 60_000);

  it("many added tokens", async () => {
    const modelId = "onnx-community/orpheus-3b-0.1-ft-ONNX";
    const { tokenizerJson, tokenizerConfig } = await fetchConfigById(modelId);
    const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

    let text = "hello world!";
    let { ids } = tokenizer.encode(text);
    expect(ids).toEqual([128000, 15339, 1917, 0]);
  }, 5000); // NOTE: 5 seconds

  it("normalizes Python-oriented regex for JS", () => {
    const quotePattern = create_pattern({ Regex: "['\\\\\"]" });
    expect(quotePattern).not.toBeNull();
    expect(quotePattern!.test('"')).toBe(true);
    quotePattern!.lastIndex = 0;
    expect(quotePattern!.test("'")).toBe(true);
    quotePattern!.lastIndex = 0;
    expect(quotePattern!.test("\\")).toBe(true);

    const wordPattern = create_pattern({ Regex: "\\w+" });
    expect(wordPattern).not.toBeNull();
    expect(wordPattern!.test("abc")).toBe(true);
    wordPattern!.lastIndex = 0;
    expect(wordPattern!.test("שלום")).toBe(true);
  });

  it("warns for unsupported \\W normalization inside character classes", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const pattern = create_pattern({ Regex: "[\\W]" });
      expect(pattern).not.toBeNull();
      expect(warn).toHaveBeenCalledWith("Tokenizer regex contains \\W inside a character class, which is not Unicode-normalized yet.");
    } finally {
      warn.mockRestore();
    }
  });

  it("tracks character classes across escaped brackets", () => {
    const escapedOpen = create_pattern({ Regex: "\\[\\w+" });
    expect(escapedOpen).not.toBeNull();
    expect(escapedOpen!.test("[שלום")).toBe(true);

    const escapedCloseInClass = create_pattern({ Regex: "[\\]\\w]" });
    expect(escapedCloseInClass).not.toBeNull();
    expect(escapedCloseInClass!.test("]")).toBe(true);
    escapedCloseInClass!.lastIndex = 0;
    expect(escapedCloseInClass!.test("ש")).toBe(true);
  });

  it("compiles tokenizer regexes sampled from the HF Hub", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const failures: string[] = [];

    try {
      for (const regex of HUB_REGEX_PATTERNS) {
        try {
          expect(create_pattern({ Regex: regex })).not.toBeNull();
        } catch (error) {
          failures.push(`${JSON.stringify(regex)}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } finally {
      warn.mockRestore();
    }

    expect(failures).toEqual([]);
  });
});
