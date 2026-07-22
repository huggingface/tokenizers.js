import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer } from "../src";
import { create_pattern } from "../src/utils/core";

const compile_regex = (source: string): RegExp => {
  const pattern = create_pattern({ Regex: source });
  if (pattern === null) throw new Error("Expected a compiled regex");
  return pattern;
};

const expect_syntax_error = (source: string, message: RegExp): void => {
  let error: unknown;
  try {
    compile_regex(source);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(SyntaxError);
  expect((error as SyntaxError).message).toMatch(message);
};

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
    const quotePattern = compile_regex("['\\\\\"]");
    expect(quotePattern.test('"')).toBe(true);
    quotePattern.lastIndex = 0;
    expect(quotePattern.test("'")).toBe(true);
    quotePattern.lastIndex = 0;
    expect(quotePattern.test("\\")).toBe(true);

    const wordPattern = compile_regex("\\w+");
    expect(wordPattern.test("abc")).toBe(true);
    wordPattern.lastIndex = 0;
    expect(wordPattern.test("שלום")).toBe(true);
  });

  it("retries short script properties independently of engine error wording", () => {
    const NativeRegExp = globalThis.RegExp;
    class AlternatePropertyErrorRegExp extends NativeRegExp {
      constructor(pattern?: string | RegExp, flags?: string) {
        try {
          super(pattern, flags);
        } catch (error) {
          if (error instanceof SyntaxError && /invalid property name/i.test(error.message)) {
            throw new SyntaxError("Invalid regular expression: invalid property expression");
          }
          throw error;
        }
      }
    }

    globalThis.RegExp = AlternatePropertyErrorRegExp as RegExpConstructor;
    try {
      const inlineCaseFold = compile_regex("(?i:[A-Z&&[^\\p{Han}]])+");
      expect("abc ABC 汉𠀀".match(inlineCaseFold)).toEqual(["abc", "ABC"]);
      expect_syntax_error("\\p{Han}(", /invalid property expression/i);
    } finally {
      globalThis.RegExp = NativeRegExp;
    }
  });

  it("does not rewrite escaped property-like literals during script fallback", () => {
    const pattern = compile_regex(String.raw`\p{Han}[\\p{Han}]`);
    const propertyAfterLiteralBackslash = compile_regex(String.raw`\\\p{Han}`);

    const matches = (input: string) => {
      pattern.lastIndex = 0;
      return pattern.test(input);
    };
    expect(matches("汉p")).toBe(true);
    expect(matches("汉\\")).toBe(true);
    expect(matches("汉S")).toBe(false);
    expect(matches("汉字")).toBe(false);
    expect("\\汉".match(propertyAfterLiteralBackslash)).toEqual(["\\汉"]);
    expect("汉".match(propertyAfterLiteralBackslash)).toBeNull();
  });

  it("rewrites \\W inside positive character classes with Unicode semantics", () => {
    const pattern = compile_regex("[\\W]");
    expect(pattern.test("!")).toBe(true);
    pattern.lastIndex = 0;
    expect(pattern.test("ש")).toBe(false);

    const mixed = compile_regex("[\\W_]");
    expect(mixed.test("_")).toBe(true);
    mixed.lastIndex = 0;
    expect(mixed.test("ש")).toBe(false);
  });

  it("tracks character classes across escaped brackets", () => {
    const escapedOpen = compile_regex("\\[\\w+");
    expect(escapedOpen.test("[שלום")).toBe(true);

    const escapedCloseInClass = compile_regex("[\\]\\w]");
    expect(escapedCloseInClass.test("]")).toBe(true);
    escapedCloseInClass.lastIndex = 0;
    expect(escapedCloseInClass.test("ש")).toBe(true);
  });

  it("preserves escaped quantifier literals", () => {
    expect("++".match(compile_regex("\\++"))).toEqual(["++"]);
  });

  it("treats astral literals as single atoms during stacked quantifier rewriting", () => {
    for (const source of ["😀{2}+", "\\😀{2}+"]) {
      const pattern = compile_regex(source);
      for (const input of ["😀😀", "😀😀😀😀"]) {
        pattern.lastIndex = 0;
        expect(input.match(pattern)).toEqual([input]);
      }
      for (const input of ["😀", "😀😀😀"]) {
        pattern.lastIndex = 0;
        expect(input.match(pattern)).not.toEqual([input]);
      }
    }
  });

  it("translates Kimi-shaped character-class intersections", () => {
    const pattern = compile_regex("[\\p{L}\\p{M}&&[^\\p{Han}]]+");
    expect("Aé\u0301汉B字 שלום".match(pattern)).toEqual(["Aé\u0301", "B", "שלום"]);
  });

  it("restores ASCII case-folding state after a scoped group", () => {
    const pattern = compile_regex("^(?i:a)b$");
    expect(pattern.test("Ab")).toBe(true);
    pattern.lastIndex = 0;
    expect(pattern.test("AB")).toBe(false);
  });

  it.each([
    {
      name: "adjacent ordinary classes outside the quantified atom",
      source: "[a-z&&[def]]+[0-9]+[A-Z]",
      input: "def12Z abc12Z",
      expected: ["def12Z"],
    },
    {
      name: "an unbracketed right-hand union",
      source: "[a-z&&def]+",
      input: "abc def xyz",
      expected: ["def"],
    },
    {
      name: "outer negation of the completed intersection",
      source: "[^a-z&&[^m-p]]+",
      input: "ABC abc mnop 123",
      expected: ["ABC ", " mnop 123"],
    },
    {
      name: "a direct Unicode-property complement",
      source: "[^\\P{Alphabetic}&&[!]]+",
      input: "a!1 ש",
      expected: ["a", "1 ש"],
    },
    {
      name: "a lifted shorthand complement in a nested class",
      source: "[^!&&[\\W]]+",
      input: "a!1 ש",
      expected: ["a", "1 ש"],
    },
    {
      name: "recursive intersections",
      source: "[a-z&&[d-z&&[^x]]]+",
      input: "abc def xyz",
      expected: ["def", "yz"],
    },
  ])("composes intersections with $name", ({ source, input, expected }) => {
    expect(input.match(compile_regex(source))).toEqual(expected);
  });

  it.each([
    {
      name: "escaped brackets",
      source: "[\\[\\]a-z&&[^\\[\\]]]+",
      input: "[abc][]",
      expected: ["abc"],
    },
    {
      name: "raw literal ampersands",
      source: "[a&]+",
      input: "a&&b",
      expected: ["a&&"],
    },
    {
      name: "escaped literal ampersands",
      source: "[\\&\\&]+",
      input: "a&&b",
      expected: ["&&"],
    },
    {
      name: "negated POSIX operands",
      source: "[[:^alpha:]&&[^!]]+",
      input: "a 1!?ש",
      expected: [" 1", "?"],
    },
    {
      name: "terminal hyphens",
      source: "[[:alpha:]-&&[-def]]+",
      input: "-defx A-",
      expected: ["-def", "-"],
    },
    {
      name: "initial closing brackets",
      source: "[]a-z&&[]a]]+",
      input: "]abc",
      expected: ["]a"],
    },
    {
      name: "POSIX-like ordinary nested class syntax",
      source: "[[:a-b:]]+",
      input: "a:b-c",
      expected: ["a:b"],
    },
    {
      name: "an escaped astral range endpoint",
      source: "[😀-\\😁-\\p{Nd}]+",
      input: "😀😁-5😂!",
      expected: ["😀😁-5"],
    },
  ])("matches Oniguruma semantics for $name", ({ source, input, expected }) => {
    expect(input.match(compile_regex(source))).toEqual(expected);
  });

  it.each([
    {
      shorthand: "\\W",
      source: "[\\W&&[^!]]+",
      input: "!? ש_a",
      expected: ["? "],
    },
    {
      shorthand: "\\H",
      source: "[\\H&&[^z]]+",
      input: "g-z Z!",
      expected: ["g-", " Z!"],
    },
  ])("retains lifted $shorthand inside intersections", ({ source, input, expected }) => {
    expect(input.match(compile_regex(source))).toEqual(expected);
  });

  it.each([
    {
      name: "an empty right-hand intersection operand",
      source: "[a-z&&]",
      message: /intersection/i,
    },
    {
      name: "an empty left-hand intersection operand",
      source: "[&&[a-z]]",
      message: /intersection/i,
    },
    {
      name: "an unterminated outer character class",
      source: "[a-z&&[def]",
      message: /character class|intersection/i,
    },
    {
      name: "a POSIX collating expression",
      source: "[[.a.]&&[a]]",
      message: /POSIX|intersection/i,
    },
    {
      name: "a nested class as a range start",
      source: "[a-z&&[d-f]-x]",
      message: /range|intersection/i,
    },
    {
      name: "a POSIX class as a range start",
      source: "[[:alpha:]-z]",
      message: /range/i,
    },
    {
      name: "a Unicode property as a range endpoint",
      source: "[a-z&&[x-\\p{L}]]+",
      message: /range|intersection/i,
    },
    {
      name: "a nested class as a range endpoint",
      source: "[a-z&&[x-[def]]]+",
      message: /range|intersection/i,
    },
    {
      name: "a descending range under case folding",
      source: "(?i:[_-A]+)",
      message: /range/i,
    },
    {
      name: "a negated POSIX lowercase class under case folding",
      source: "(?i:[[:^lower:]]+)",
      message: /POSIX|case-insensitive/i,
    },
    {
      name: "outer negation over a nested property complement",
      source: "[^[^\\p{L}]&&[a]]",
      message: /outer-negated/i,
    },
    {
      name: "outer negation over a nested POSIX complement",
      source: "[^[^[:alpha:]]&&[a]]",
      message: /outer-negated/i,
    },
    {
      name: "outer negation over a nested shorthand complement",
      source: "[^[^\\W]&&[a]]",
      message: /outer-negated/i,
    },
    {
      name: "an inherited-object POSIX name",
      source: "[a-z&&[[:constructor:]]]",
      message: /POSIX/i,
    },
    {
      name: "a wrongly cased POSIX name",
      source: "[a-z&&[[:Alpha:]]]",
      message: /POSIX/i,
    },
    {
      name: "a missing negated POSIX name",
      source: "[a-z&&[[:^:]]]",
      message: /POSIX/i,
    },
  ])("rejects $name", ({ source, message }) => {
    expect_syntax_error(source, message);
  });

  it("enforces the character-class nesting limit", () => {
    const supportedNesting = `${"[".repeat(256)}a${"]".repeat(256)}`;
    expect(compile_regex(supportedNesting).test("a")).toBe(true);

    const excessiveNesting = `${"[".repeat(257)}a${"]".repeat(257)}`;
    expect_syntax_error(excessiveNesting, /maximum character-class nesting depth of 256/i);
  });
});
