import { Tokenizer } from "../src";

import type { TokenizerJSON } from "../src/static/tokenizer";

// Expected values below were produced by the Python `tokenizers` 0.23.2 package
// (`Tokenizer.from_str(...).encode(text, add_special_tokens=False)`), not by this implementation.
// With `fuse_unk`, consecutive unknown tokens are merged only within a single word (pre-token),
// never across word boundaries.
type Case = [name: string, text: string, tokens: string[], ids: number[]];

const create_tokenizer = (model: unknown): Tokenizer =>
  new Tokenizer(
    {
      version: "1.0",
      truncation: null,
      padding: null,
      added_tokens: [],
      normalizer: null,
      pre_tokenizer: { type: "WhitespaceSplit" },
      post_processor: null,
      decoder: null,
      model,
    } as TokenizerJSON,
    {},
  );

const bpe_model = (fuse_unk: boolean) => ({
  type: "BPE",
  vocab: { "<unk>": 0, a: 1, b: 2, c: 3, ab: 4, bc: 5 },
  merges: [
    ["a", "b"],
    ["b", "c"],
  ],
  unk_token: "<unk>",
  fuse_unk,
});

const unigram_model = {
  type: "Unigram",
  unk_id: 0,
  vocab: [
    ["<unk>", 0],
    ["a", -1],
    ["b", -1],
    ["c", -1],
    ["ab", -0.5],
    ["bc", -0.5],
  ],
};

const run_cases = (tokenizer: Tokenizer, cases: Case[]): void => {
  it.each(cases)("matches Python tokenizers: %s", (_name, text, tokens, ids) => {
    const encoding = tokenizer.encode(text, { add_special_tokens: false });
    expect(encoding.tokens).toEqual(tokens);
    expect(encoding.ids).toEqual(ids);
  });
};

describe("fuse_unk is applied per word", () => {
  describe("BPE with fuse_unk: true", () => {
    run_cases(create_tokenizer(bpe_model(true)), [
      ["unknown words separated by a known word", "a \u2603 \u2603 b", ["a", "<unk>", "<unk>", "b"], [1, 0, 0, 2]],
      ["two unknown words", "\u2603 \u2603", ["<unk>", "<unk>"], [0, 0]],
      ["one word made of unknown characters", "\u2603\u2603", ["<unk>"], [0]],
      ["unknown characters inside and across words", "a\u2603\u2603b \u2603", ["a", "<unk>", "b", "<unk>"], [1, 0, 2, 0]],
      ["unknown words separated by mixed whitespace", "\u2603  \u2603\t\u2603", ["<unk>", "<unk>", "<unk>"], [0, 0, 0]],
      ["only unknown words", "x y z", ["<unk>", "<unk>", "<unk>"], [0, 0, 0]],
      ["known and unknown words", "abc xy ab", ["ab", "c", "<unk>", "ab"], [4, 3, 0, 4]],
      ["unknown accented words", "ab \u00e9\u00e9 \u00e9 c", ["ab", "<unk>", "<unk>", "c"], [4, 0, 0, 3]],
    ]);
  });

  describe("BPE with fuse_unk: false", () => {
    run_cases(create_tokenizer(bpe_model(false)), [
      ["unknown words separated by a known word", "a \u2603 \u2603 b", ["a", "<unk>", "<unk>", "b"], [1, 0, 0, 2]],
      ["two unknown words", "\u2603 \u2603", ["<unk>", "<unk>"], [0, 0]],
      ["one word made of unknown characters", "\u2603\u2603", ["<unk>", "<unk>"], [0, 0]],
      ["unknown characters inside and across words", "a\u2603\u2603b \u2603", ["a", "<unk>", "<unk>", "b", "<unk>"], [1, 0, 0, 2, 0]],
      ["unknown words separated by mixed whitespace", "\u2603  \u2603\t\u2603", ["<unk>", "<unk>", "<unk>"], [0, 0, 0]],
      ["only unknown words", "x y z", ["<unk>", "<unk>", "<unk>"], [0, 0, 0]],
      ["known and unknown words", "abc xy ab", ["ab", "c", "<unk>", "<unk>", "ab"], [4, 3, 0, 0, 4]],
      ["unknown accented words", "ab \u00e9\u00e9 \u00e9 c", ["ab", "<unk>", "<unk>", "<unk>", "c"], [4, 0, 0, 0, 3]],
    ]);
  });

  // Unigram always fuses unknown tokens.
  describe("Unigram", () => {
    run_cases(create_tokenizer(unigram_model), [
      ["unknown words separated by a known word", "a \u2603 \u2603 b", ["a", "\u2603", "\u2603", "b"], [1, 0, 0, 2]],
      ["two unknown words", "\u2603 \u2603", ["\u2603", "\u2603"], [0, 0]],
      ["one word made of unknown characters", "\u2603\u2603", ["\u2603\u2603"], [0]],
      ["unknown characters inside and across words", "a\u2603\u2603b \u2603", ["a", "\u2603\u2603", "b", "\u2603"], [1, 0, 2, 0]],
      ["unknown words separated by mixed whitespace", "\u2603  \u2603\t\u2603", ["\u2603", "\u2603", "\u2603"], [0, 0, 0]],
      ["only unknown words", "x y z", ["x", "y", "z"], [0, 0, 0]],
      ["known and unknown words", "abc xy ab", ["a", "bc", "xy", "ab"], [1, 5, 0, 4]],
      ["unknown accented words", "ab \u00e9\u00e9 \u00e9 c", ["ab", "\u00e9\u00e9", "\u00e9", "c"], [4, 0, 0, 3]],
    ]);
  });
});
