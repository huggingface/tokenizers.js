import { BPE } from "../src";

import type { TokenizerConfigBPEModel } from "../src/static/tokenizer";

describe("BPE", () => {
  const create_config = (merges: TokenizerConfigBPEModel["merges"]): TokenizerConfigBPEModel => ({
    type: "BPE",
    unk_token: "<unk>",
    continuing_subword_suffix: null,
    end_of_word_suffix: null,
    fuse_unk: false,
    byte_fallback: false,
    ignore_merges: false,
    vocab: { "<unk>": 0, a: 1, b: 2, c: 3, " ": 4, ab: 5, abc: 6, "a b": 7 },
    merges,
  });

  // Tokenizers >= 0.20.0 serializes merges as pairs of tokens, earlier versions as space-separated strings.
  const MERGE_FORMATS: Record<string, TokenizerConfigBPEModel["merges"]> = {
    pairs: [
      ["a", "b"],
      ["ab", "c"],
    ],
    strings: ["a b", "ab c"],
  };

  for (const [format, merges] of Object.entries(MERGE_FORMATS)) {
    describe(`merges as ${format}`, () => {
      it("encodes with the merges", () => {
        const bpe = new BPE(create_config(merges));
        expect(bpe.encode(["abc", "cab", "ba", "d"])).toEqual(["abc", "c", "ab", "b", "a", "<unk>"]);
      });

      it("exposes the merges as pairs of tokens in order of rank", () => {
        const bpe = new BPE(create_config(merges));
        expect(bpe.merges).toEqual([
          ["a", "b"],
          ["ab", "c"],
        ]);
      });

      it("keeps the settings of its config, without the raw vocab and merges", () => {
        const config = create_config(merges);
        const { vocab: _vocab, merges: _merges, ...settings } = config;
        const bpe = new BPE(config);
        expect(bpe.config).toEqual(settings);
      });

      it("does not modify the config it is given", () => {
        const config = create_config(merges);
        new BPE(config);
        expect(config).toEqual(create_config(merges));
      });
    });
  }

  it("tells apart merges whose tokens contain spaces", () => {
    const bpe = new BPE(
      create_config([
        ["a", " "],
        ["a ", "b"],
      ]),
    );
    expect(bpe.merges).toEqual([
      ["a", " "],
      ["a ", "b"],
    ]);
    expect(bpe.encode(["a b"])).toEqual(["a b"]);
    expect(bpe.encode([" b"])).toEqual([" ", "b"]);
  });
});
