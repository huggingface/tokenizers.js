import { readFileSync } from "node:fs";

import type { TokenizerConfigPreTokenizerSplit } from "../../src/static/tokenizer";

type SplitBehavior = TokenizerConfigPreTokenizerSplit["behavior"];

type SplitRegexPattern = {
  id: string;
  name?: string;
  pattern: string;
  behavior?: SplitBehavior;
  invert?: boolean;
  inputs?: string[];
};

type SplitRegexCase = {
  name: string;
  patternId: string;
  behavior?: SplitBehavior;
  invert?: boolean;
  inputs?: string[];
};

type SplitRegexFixture = {
  schemaVersion: number;
  defaults: {
    behavior: SplitBehavior;
    invert: boolean;
    inputs: string[];
  };
  patterns: SplitRegexPattern[];
  additionalCases?: SplitRegexCase[];
};

export type ResolvedSplitRegexCase = {
  name: string;
  patternId: string;
  pattern: string;
  behavior: SplitBehavior;
  invert: boolean;
  inputs: string[];
};

export const splitRegexFixture = JSON.parse(readFileSync(new URL("../fixtures/splitRegexPatterns.json", import.meta.url), "utf8")) as SplitRegexFixture;

export const splitRegexPatterns = splitRegexFixture.patterns;

export const legacyProblematicRegexPatternIds = ["problematic-inline-contractions", "problematic-inline-openai-suffix", "problematic-possessive-prefix-punctuation", "problematic-possessive-punctuation-run", "problematic-atomic-digit-group", "problematic-stacked-quantifier", "problematic-g-anchor", "hub-051"] as const;

const patternById = new Map(splitRegexFixture.patterns.map((pattern) => [pattern.id, pattern]));

const resolveCase = (testCase: SplitRegexCase): ResolvedSplitRegexCase => {
  const pattern = patternById.get(testCase.patternId);
  if (pattern === undefined) {
    throw new Error(`Unknown split regex pattern: ${testCase.patternId}`);
  }

  return {
    name: testCase.name,
    patternId: testCase.patternId,
    pattern: pattern.pattern,
    behavior: testCase.behavior ?? pattern.behavior ?? splitRegexFixture.defaults.behavior,
    invert: testCase.invert ?? pattern.invert ?? splitRegexFixture.defaults.invert,
    inputs: testCase.inputs ?? pattern.inputs ?? splitRegexFixture.defaults.inputs,
  };
};

export const splitRegexCases = [
  ...splitRegexFixture.patterns.map((pattern) =>
    resolveCase({
      name: pattern.name ?? pattern.id,
      patternId: pattern.id,
    }),
  ),
  ...(splitRegexFixture.additionalCases ?? []).map(resolveCase),
];

export const splitRegexCaseByName = new Map(splitRegexCases.map((testCase) => [testCase.name, testCase]));
