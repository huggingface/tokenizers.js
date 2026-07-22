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

  it("treats astral literals as single regex atoms", () => {
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
    expect("A𐐀𠀀B".match(pattern)).toEqual(["A𐐀", "B"]);
  });

  it("preserves quantifier scope on character-class intersections", () => {
    const cases = [
      {
        quantifier: "+",
        accepted: ["d", "deff"],
        rejected: ["", "dex"],
      },
      {
        quantifier: "*",
        accepted: ["", "deff"],
        rejected: ["dex"],
      },
      {
        quantifier: "?",
        accepted: ["", "d"],
        rejected: ["dd", "x"],
      },
      {
        quantifier: "{2,3}",
        accepted: ["de", "def"],
        rejected: ["d", "deff"],
      },
    ];

    for (const { quantifier, accepted, rejected } of cases) {
      const pattern = compile_regex(`^[a-z&&[def]]${quantifier}$`);
      for (const input of accepted) {
        pattern.lastIndex = 0;
        expect(pattern.test(input)).toBe(true);
      }
      for (const input of rejected) {
        pattern.lastIndex = 0;
        expect(pattern.test(input)).toBe(false);
      }
    }
  });

  it("composes intersections with adjacent classes and set operands", () => {
    const adjacent = compile_regex("^[a-z&&[def]]+[0-9]+[A-Z]$");
    expect(adjacent.test("def12Z")).toBe(true);
    adjacent.lastIndex = 0;
    expect(adjacent.test("abc12Z")).toBe(false);

    const rawRightOperand = compile_regex("[a-z&&def]+");
    expect("abc def xyz".match(rawRightOperand)).toEqual(["def"]);

    const outerNegated = compile_regex("[^a-z&&[^m-p]]+");
    expect("ABC abc mnop 123".match(outerNegated)).toEqual(["ABC ", " mnop 123"]);

    // Direct complements are supported; only nested negated classes are rejected.
    for (const regex of ["[^\\P{Alphabetic}&&[a]]+", "[^a&&[\\W]]+"]) {
      expect("aA1 !ש".match(compile_regex(regex))).toEqual(["aA1 !ש"]);
    }

    const scopedCaseInsensitive = compile_regex("^(?i:a)b$");
    expect(scopedCaseInsensitive.test("Ab")).toBe(true);
    scopedCaseInsensitive.lastIndex = 0;
    expect(scopedCaseInsensitive.test("AB")).toBe(false);

    const recursive = compile_regex("[a-z&&[d-z&&[^x]]]+");
    expect("abc def xyz".match(recursive)).toEqual(["def", "yz"]);

    const overlappingNestedUnion = compile_regex("[a[a-z]&&[^x]]+b");
    expect(overlappingNestedUnion.source).toMatch(/\+b$/);
    expect("aaab xyzb".match(overlappingNestedUnion)).toEqual(["aaab", "yzb"]);
    expect("aaac".match(overlappingNestedUnion)).toBeNull();
  });

  it("applies inline case folding after character-class intersection", () => {
    const disjoint = compile_regex("(?i:[a-z&&[A-Z]])+");
    expect("abc ABC".match(disjoint)).toBeNull();

    const negatedOperand = compile_regex("(?i:[a-z&&[^A-Z]])+");
    expect("abc ABC aA 123".match(negatedOperand)).toEqual(["abc", "ABC", "aA"]);

    const outerNegated = compile_regex("(?i:[^a&&[A]])+");
    expect("aA bB 123".match(outerNegated)).toEqual(["aA bB 123"]);

    const nonemptyOuterNegated = compile_regex("(?i:[^A-Z&&[D-F]])+");
    expect("abc DEF fed XYZ 123".match(nonemptyOuterNegated)).toEqual(["abc ", " ", " XYZ 123"]);
  });

  it.each([
    {
      name: "escaped brackets",
      regex: "[\\[\\]a-z&&[^\\[\\]]]+",
      input: "[abc][]",
      expected: ["abc"],
    },
    {
      name: "literal ampersands",
      regex: "[a&]+",
      input: "a&&b",
      expected: ["a&&"],
    },
    {
      name: "escaped intersection marker",
      regex: "[\\&\\&]+",
      input: "a&&b",
      expected: ["&&"],
    },
    {
      name: "negated POSIX operands",
      regex: "[[:^alpha:]&&[^!]]+",
      input: "a 1!?ש",
      expected: [" 1", "?"],
    },
    {
      name: "terminal hyphens",
      regex: "[[:alpha:]-&&[-def]]+",
      input: "-defx A-",
      expected: ["-def", "-"],
    },
    {
      name: "initial closing brackets",
      regex: "[]a-z&&[]a]]+",
      input: "]abc",
      expected: ["]a"],
    },
    {
      name: "sets after ranges",
      regex: "[a-f-\\w]+",
      input: "a-f z שלום!",
      expected: ["a-f", "z", "שלום"],
    },
    {
      name: "escaped range starts",
      regex: "(?i:[\\[-a]+)",
      input: "A!",
      expected: ["A"],
    },
    {
      name: "escaped astral range endpoints",
      regex: "[😀-\\😁-\\p{Nd}]+",
      input: "😀😁-5😂!",
      expected: ["😀😁-5"],
    },
  ])("parses $name in character classes", ({ regex, input, expected }) => {
    expect(input.match(compile_regex(regex))).toEqual(expected);
  });

  it("retains lifted complement shorthands inside intersections", () => {
    const nonWordExceptBang = compile_regex("[\\W&&[^!]]+");
    expect("!? ש_a".match(nonWordExceptBang)).toEqual(["? "]);

    const nonHexExceptZ = compile_regex("[\\H&&[^z]]+");
    expect("g-z Z!".match(nonHexExceptZ)).toEqual(["g-", " Z!"]);
  });

  it("rejects malformed or unsupported character-class constructs", () => {
    expect_syntax_error("[a-z&&]", /intersection/i);
    expect_syntax_error("[&&[a-z]]", /intersection/i);
    expect_syntax_error("[a-z&&&&[b]]", /intersection/i);
    expect_syntax_error("[a-z&&[def]", /character class|intersection/i);
    expect_syntax_error("[[:graph:]&&[a-z]]+", /POSIX|intersection/i);
    expect_syntax_error("[[.a.]&&[a]]", /POSIX|intersection/i);
    expect_syntax_error("[a-z&&[d-f]-x]", /range|intersection/i);
    expect_syntax_error("[a-z&&[a[def]-x]]+", /range|intersection/i);
    expect_syntax_error("[a-z&&[x-\\W]]+", /range|intersection/i);
    expect_syntax_error("[a-z&&[x-\\p{L}]]+", /range|intersection/i);
    expect_syntax_error("[a-z&&[x-[def]]]+", /range|intersection/i);
    expect_syntax_error("(?i:[_-A]+)", /range/i);
    expect_syntax_error("(?i:[[:^lower:]]+)", /POSIX|case-insensitive/i);
    expect_syntax_error("(?i:[a-z&&[[:lower:]-z]]+)", /range|intersection/i);
    // Reject the documented non-Boolean outer-negation corner rather than approximating it.
    expect_syntax_error("[^[^\\p{Alphabetic}]&&[^\\P{Alphabetic}]]", /outer-negated/i);
    expect_syntax_error("[^[^[:alpha:]]&&[^[:^alpha:]]]", /outer-negated/i);
    expect_syntax_error("[^[^a]a&&[^\\H]]", /outer-negated/i);

    const supportedNesting = `${"[".repeat(256)}a${"]".repeat(256)}`;
    expect(compile_regex(supportedNesting).test("a")).toBe(true);

    const excessiveNesting = `${"[".repeat(257)}a${"]".repeat(257)}`;
    expect_syntax_error(excessiveNesting, /maximum character-class nesting depth of 256/i);
    expect_syntax_error(`${"[".repeat(257)}a`, /maximum character-class nesting depth of 256/i);
  });
});
