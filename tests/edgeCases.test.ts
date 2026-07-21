import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer } from "../src";
import { create_pattern } from "../src/utils/core";

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

  it("retries short Unicode script properties independently of engine error wording", () => {
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

    let kimi: RegExp | null = null;
    let inlineCaseFold: RegExp | null = null;
    let malformedError: unknown;
    globalThis.RegExp = AlternatePropertyErrorRegExp as RegExpConstructor;
    try {
      kimi = create_pattern({
        Regex: "[\\p{L}\\p{M}&&[^\\p{Han}]]+",
      });
      inlineCaseFold = create_pattern({
        Regex: "(?i:[A-Z&&[^\\p{Han}]])+",
      });
      try {
        create_pattern({ Regex: "\\p{Han}(" });
      } catch (error) {
        malformedError = error;
      }
    } finally {
      globalThis.RegExp = NativeRegExp;
    }

    expect("Aé\u0301汉B字 שלום".match(kimi!)).toEqual(["Aé\u0301", "B", "שלום"]);
    expect("abc ABC 汉𠀀".match(inlineCaseFold!)).toEqual(["abc", "ABC"]);
    expect(malformedError).toBeInstanceOf(SyntaxError);
    expect((malformedError as SyntaxError).message).toContain("invalid property expression");
  });

  it("does not rewrite escaped property-like literals during script fallback", () => {
    const pattern = create_pattern({
      Regex: String.raw`\p{Han}[\\p{Han}]`,
    });
    const propertyAfterLiteralBackslash = create_pattern({
      Regex: String.raw`\\\p{Han}`,
    });
    expect(pattern).not.toBeNull();
    expect(propertyAfterLiteralBackslash).not.toBeNull();

    const matches = (input: string) => {
      pattern!.lastIndex = 0;
      return pattern!.test(input);
    };
    expect(matches("汉p")).toBe(true);
    expect(matches("汉\\")).toBe(true);
    expect(matches("汉S")).toBe(false);
    expect(matches("汉字")).toBe(false);
    expect("\\汉".match(propertyAfterLiteralBackslash!)).toEqual(["\\汉"]);
    expect("汉".match(propertyAfterLiteralBackslash!)).toBeNull();
  });

  it("rewrites \\W inside positive character classes with Unicode semantics", () => {
    const pattern = create_pattern({ Regex: "[\\W]" });
    expect(pattern).not.toBeNull();
    expect(pattern!.test("!")).toBe(true);
    pattern!.lastIndex = 0;
    expect(pattern!.test("ש")).toBe(false);

    const mixed = create_pattern({ Regex: "[\\W_]" });
    expect(mixed).not.toBeNull();
    expect(mixed!.test("_")).toBe(true);
    mixed!.lastIndex = 0;
    expect(mixed!.test("ש")).toBe(false);
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

  it("preserves escaped quantifier literals", () => {
    const literalPlusRun = create_pattern({ Regex: "\\++" });
    expect(literalPlusRun).not.toBeNull();
    expect("++".match(literalPlusRun!)).toEqual(["++"]);
  });

  it("translates Kimi-shaped character-class intersections", () => {
    const pattern = create_pattern({
      Regex: "[\\p{L}\\p{M}&&[^\\p{Han}]]+",
    });
    expect(pattern).not.toBeNull();
    expect("Aé\u0301汉B字 שלום".match(pattern!)).toEqual(["Aé\u0301", "B", "שלום"]);
    expect("A𐐀𠀀B".match(pattern!)).toEqual(["A𐐀", "B"]);
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
      const pattern = create_pattern({
        Regex: `^[a-z&&[def]]${quantifier}$`,
      });
      expect(pattern).not.toBeNull();
      for (const input of accepted) {
        pattern!.lastIndex = 0;
        expect(pattern!.test(input)).toBe(true);
      }
      for (const input of rejected) {
        pattern!.lastIndex = 0;
        expect(pattern!.test(input)).toBe(false);
      }
    }
  });

  it("composes intersections with adjacent classes and set operands", () => {
    const adjacent = create_pattern({
      Regex: "^[a-z&&[def]]+[0-9]+[A-Z]$",
    });
    expect(adjacent).not.toBeNull();
    expect(adjacent!.test("def12Z")).toBe(true);
    adjacent!.lastIndex = 0;
    expect(adjacent!.test("abc12Z")).toBe(false);

    const rawRightOperand = create_pattern({ Regex: "[a-z&&def]+" });
    expect(rawRightOperand).not.toBeNull();
    expect("abc def xyz".match(rawRightOperand!)).toEqual(["def"]);

    const outerNegated = create_pattern({
      Regex: "[^a-z&&[^m-p]]+",
    });
    expect(outerNegated).not.toBeNull();
    expect("ABC abc mnop 123".match(outerNegated!)).toEqual(["ABC ", " mnop 123"]);

    // Direct complements remain safe membership operands; only an additional nested `^`
    // around a complex set enters Oniguruma's non-Boolean outer-negation corner.
    for (const regex of ["[^\\P{Alphabetic}&&[a]]+", "[^a&&[\\W]]+"]) {
      const safeOuterNegated = create_pattern({ Regex: regex });
      expect(safeOuterNegated).not.toBeNull();
      expect("aA1 !ש".match(safeOuterNegated!)).toEqual(["aA1 !ש"]);
    }

    const caseInsensitive = create_pattern({
      Regex: "(?i:[a-z&&[def]]+)",
    });
    expect(caseInsensitive).not.toBeNull();
    expect("ABC DEF fed".match(caseInsensitive!)).toEqual(["DEF", "fed"]);

    const scopedCaseInsensitive = create_pattern({
      Regex: "^(?i:a)b$",
    });
    expect(scopedCaseInsensitive).not.toBeNull();
    expect(scopedCaseInsensitive!.test("Ab")).toBe(true);
    scopedCaseInsensitive!.lastIndex = 0;
    expect(scopedCaseInsensitive!.test("AB")).toBe(false);

    const caseInsensitivePosix = create_pattern({
      Regex: "(?i:[a-z&&[[:lower:]]]+)",
    });
    expect(caseInsensitivePosix).not.toBeNull();
    expect("abc DEF fed".match(caseInsensitivePosix!)).toEqual(["abc", "DEF", "fed"]);

    const recursive = create_pattern({
      Regex: "[a-z&&[d-z&&[^x]]]+",
    });
    expect(recursive).not.toBeNull();
    expect("abc def xyz".match(recursive!)).toEqual(["def", "yz"]);

    const overlappingNestedUnion = create_pattern({
      Regex: "[a[a-z]&&[^x]]+b",
    });
    expect(overlappingNestedUnion).not.toBeNull();
    expect(overlappingNestedUnion!.source).toContain("(?=(?:[a]|[a-z]))[\\s\\S]");
    expect(overlappingNestedUnion!.source).toMatch(/\+b$/);
    expect("aaab xyzb".match(overlappingNestedUnion!)).toEqual(["aaab", "yzb"]);
    expect("aaac".match(overlappingNestedUnion!)).toBeNull();
  });

  it("applies inline case folding after character-class intersection", () => {
    const disjoint = create_pattern({ Regex: "(?i:[a-z&&[A-Z]])+" });
    expect(disjoint).not.toBeNull();
    expect("abc ABC".match(disjoint!)).toBeNull();

    const negatedOperand = create_pattern({
      Regex: "(?i:[a-z&&[^A-Z]])+",
    });
    expect(negatedOperand).not.toBeNull();
    expect("abc ABC aA 123".match(negatedOperand!)).toEqual(["abc", "ABC", "aA"]);

    const outerNegated = create_pattern({ Regex: "(?i:[^a&&[A]])+" });
    expect(outerNegated).not.toBeNull();
    expect("aA bB 123".match(outerNegated!)).toEqual(["aA bB 123"]);

    const nonemptyOuterNegated = create_pattern({
      Regex: "(?i:[^A-Z&&[D-F]])+",
    });
    expect(nonemptyOuterNegated).not.toBeNull();
    expect("abc DEF fed XYZ 123".match(nonemptyOuterNegated!)).toEqual(["abc ", " ", " XYZ 123"]);

    const escapedRange = create_pattern({
      Regex: "(?i:[\\x61-\\x7a&&[^\\u0078]])+",
    });
    expect(escapedRange).not.toBeNull();
    expect("abc XYZ xyz".match(escapedRange!)).toEqual(["abc", "YZ", "yz"]);

    // The internal set-membership probe must use the same short-script fallback as the
    // final expression, including for astral Han.
    const shortScript = create_pattern({
      Regex: "(?i:[A-Z&&[^\\p{Han}]])+",
    });
    expect(shortScript).not.toBeNull();
    expect("abc ABC 汉𠀀".match(shortScript!)).toEqual(["abc", "ABC"]);
  });

  it("parses escaped literals, POSIX operands, and range tails", () => {
    const escapedBrackets = create_pattern({
      Regex: "[\\[\\]a-z&&[^\\[\\]]]+",
    });
    expect(escapedBrackets).not.toBeNull();
    expect("[abc][]".match(escapedBrackets!)).toEqual(["abc"]);

    const literalAmpersand = create_pattern({ Regex: "[a&]+" });
    expect(literalAmpersand).not.toBeNull();
    expect("a&&b".match(literalAmpersand!)).toEqual(["a&&"]);

    const escapedAmpersands = create_pattern({ Regex: "[\\&\\&]+" });
    expect(escapedAmpersands).not.toBeNull();
    expect("a&&b".match(escapedAmpersands!)).toEqual(["&&"]);

    const negatedPosix = create_pattern({
      Regex: "[[:^alpha:]&&[^!]]+",
    });
    expect(negatedPosix).not.toBeNull();
    expect("a 1!?ש".match(negatedPosix!)).toEqual([" 1", "?"]);

    const terminalHyphen = create_pattern({
      Regex: "[[:alpha:]-&&[-def]]+",
    });
    expect(terminalHyphen).not.toBeNull();
    expect("-defx A-".match(terminalHyphen!)).toEqual(["-def", "-"]);

    const initialClosingBracket = create_pattern({
      Regex: "[]a-z&&[]a]]+",
    });
    expect(initialClosingBracket).not.toBeNull();
    expect("]abc".match(initialClosingBracket!)).toEqual(["]a"]);

    const rangeThenSet = create_pattern({
      Regex: "[a-f-\\w]+",
    });
    expect(rangeThenSet).not.toBeNull();
    expect("a-f z שלום!".match(rangeThenSet!)).toEqual(["a-f", "z", "שלום"]);

    for (const regex of ["[a-\\x7a-\\w]+", "[a-\\u007a-\\w]+"]) {
      const fixedWidthEscapeRange = create_pattern({ Regex: regex });
      expect(fixedWidthEscapeRange).not.toBeNull();
      expect("a-z Z_!".match(fixedWidthEscapeRange!)).toEqual(["a-z", "Z_"]);
    }

    const astralRange = create_pattern({
      Regex: "[𐐀-𐐨-\\w]+",
    });
    expect(astralRange).not.toBeNull();
    expect("𐐀𐐨-abc!".match(astralRange!)).toEqual(["𐐀𐐨-abc"]);

    const escapedRangeStart = create_pattern({
      Regex: "(?i:[\\[-a]+)",
    });
    expect(escapedRangeStart).not.toBeNull();
    expect("A!".match(escapedRangeStart!)).toEqual(["A"]);
  });

  it("retains lifted complement shorthands inside intersections", () => {
    const nonWordExceptBang = create_pattern({
      Regex: "[\\W&&[^!]]+",
    });
    expect(nonWordExceptBang).not.toBeNull();
    expect("!? ש_a".match(nonWordExceptBang!)).toEqual(["? "]);

    const nonHexExceptZ = create_pattern({
      Regex: "[\\H&&[^z]]+",
    });
    expect(nonHexExceptZ).not.toBeNull();
    expect("g-z Z!".match(nonHexExceptZ!)).toEqual(["g-", " Z!"]);
  });

  it("rejects malformed or unsupported character-class constructs", () => {
    const expectSyntaxError = (regex: string, message: RegExp) => {
      const compile = () => create_pattern({ Regex: regex });
      expect(compile).toThrow(SyntaxError);
      expect(compile).toThrow(message);
    };

    expectSyntaxError("[a-z&&]", /intersection/i);
    expectSyntaxError("[&&[a-z]]", /intersection/i);
    expectSyntaxError("[a-z&&&&[b]]", /intersection/i);
    expectSyntaxError("[a-z&&[def]", /character class|intersection/i);
    expectSyntaxError("[[:graph:]&&[a-z]]+", /POSIX|intersection/i);
    expectSyntaxError("[[.a.]&&[a]]", /POSIX|intersection/i);
    expectSyntaxError("[a-z&&[d-f]-x]", /range|intersection/i);
    expectSyntaxError("[a-z&&[a[def]-x]]+", /range|intersection/i);
    expectSyntaxError("[a-z&&[x-\\W]]+", /range|intersection/i);
    expectSyntaxError("[a-z&&[x-\\p{L}]]+", /range|intersection/i);
    expectSyntaxError("[a-z&&[x-[def]]]+", /range|intersection/i);
    expectSyntaxError("(?i:[_-A]+)", /range/i);
    expectSyntaxError("(?i:[[:^lower:]]+)", /POSIX|case-insensitive/i);
    expectSyntaxError("(?i:[a-z&&[[:lower:]-z]]+)", /range|intersection/i);
    // Oniguruma's outer negation is not Boolean set complement when an operand contains a
    // nested negated class over Unicode/POSIX/shorthand sets, so reject instead of approximating.
    expectSyntaxError("[^[^\\p{Alphabetic}]&&[^\\P{Alphabetic}]]", /outer-negated/i);
    expectSyntaxError("[^[^[:alpha:]]&&[^[:^alpha:]]]", /outer-negated/i);
    expectSyntaxError("[^[^a]a&&[^\\H]]", /outer-negated/i);

    const supportedNesting = `${"[".repeat(256)}a${"]".repeat(256)}`;
    const supportedPattern = create_pattern({ Regex: supportedNesting });
    expect(supportedPattern).not.toBeNull();
    expect(supportedPattern!.test("a")).toBe(true);

    const excessiveNesting = `${"[".repeat(257)}a${"]".repeat(257)}`;
    expectSyntaxError(excessiveNesting, /maximum character-class nesting depth of 256/i);
    expectSyntaxError(`${"[".repeat(257)}a`, /maximum character-class nesting depth of 256/i);
  });
});
