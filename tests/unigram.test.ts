import { Tokenizer, Unigram } from "../src";
import CharTrie from "../src/utils/data-structures/CharTrie";

import type { TokenizerJSON } from "../src/static/tokenizer";

describe("CharTrie", () => {
  it("searches the trie from a character offset", () => {
    const trie = new CharTrie();
    trie.extend(["🙂", "🙂a", "a"]);

    const chars = Array.from("x🙂ab");
    expect([...trie.common_prefix_search(chars, 1)]).toEqual(["🙂", "🙂a"]);
    expect([...trie.common_prefix_search(chars, 0)]).toEqual([]);
    expect([...trie.common_prefix_search(chars, chars.length)]).toEqual([]);
    expect([...trie.common_prefix_search(chars, chars.length + 1)]).toEqual([]);
  });
});

describe("Unigram", () => {
  it("selects the best-scoring path with overlapping Unicode tokens", () => {
    const unigram = new Unigram(
      {
        type: "Unigram",
        unk_id: 0,
        vocab: [
          ["<unk>", -10],
          ["🙂", -1],
          ["🙂a", -0.05],
          ["a", -1],
          ["ab", -0.3],
          ["abc", -0.2],
          ["b", -1],
          ["bc", -0.4],
          ["c", -1],
        ],
      },
      "</s>",
    );

    expect(unigram.encode(["🙂abc🙂a"])).toEqual(["🙂a", "bc", "🙂a"]);
    expect(unigram.encode(["x"])).toEqual(["x"]);
  });

  it("tokenizes long inputs without quadratic suffix materialization", () => {
    const vocab: Array<[string, number]> = [["<unk>", -10]];
    for (const c of "abcdefghij") {
      vocab.push([c, -1]);
    }
    for (const c1 of "abcdefghij") {
      for (const c2 of "abcdefghij") {
        vocab.push([`${c1}${c2}`, -0.5]);
      }
    }
    const unigram = new Unigram({ type: "Unigram", unk_id: 0, vocab }, "</s>");

    const text = "abcdefghij".repeat(5000); // 50,000 characters
    expect(unigram.encode([text])).toHaveLength(25000);
  }, 5000); // NOTE: 5 seconds
});

// Expected values were generated with Python `tokenizers` 0.23.3.
describe("Unigram byte fallback", () => {
  const ALL_BYTE_TOKENS = Array.from({ length: 256 }, (_, i) => `<0x${i.toString(16).toUpperCase().padStart(2, "0")}>`);

  const create_tokenizer = (byte_fallback?: boolean, byte_tokens: string[] = ALL_BYTE_TOKENS) => {
    const tokenizerJson: TokenizerJSON = {
      version: "1.0",
      added_tokens: [
        {
          id: 0,
          content: "<unk>",
          single_word: false,
          lstrip: false,
          rstrip: false,
          normalized: false,
          special: true,
        },
      ],
      normalizer: null,
      pre_tokenizer: { type: "Metaspace", replacement: "▁", prepend_scheme: "always" },
      post_processor: null,
      decoder: {
        type: "Sequence",
        decoders: [{ type: "Metaspace", replacement: "▁", prepend_scheme: "always" }, { type: "ByteFallback" }, { type: "Fuse" }],
      },
      model: {
        type: "Unigram",
        unk_id: 0,
        ...(byte_fallback === undefined ? {} : { byte_fallback }),
        vocab: [
          ["<unk>", 0],
          ["▁", -2],
          ["a", -2],
          ["b", -2],
          ["ab", -1.5],
          ["▁ab", -1],
          // Byte token ids start at 6
          ...byte_tokens.map((token): [string, number] => [token, -10]),
        ],
      },
    };
    return new Tokenizer(tokenizerJson, { unk_token: "<unk>" });
  };

  const KNOWN_TEXT = "ab a b";
  const KNOWN_TOKENS = ["▁ab", "▁", "a", "▁", "b"];
  const KNOWN_IDS = [5, 1, 2, 1, 3];

  describe("enabled", () => {
    const tokenizer = create_tokenizer(true);

    it("leaves known text unchanged", () => {
      const { ids, tokens } = tokenizer.encode(KNOWN_TEXT);
      expect(tokens).toEqual(KNOWN_TOKENS);
      expect(ids).toEqual(KNOWN_IDS);
      expect(tokenizer.decode(ids)).toEqual(KNOWN_TEXT);
    });

    it("emits UTF-8 byte tokens for an unknown piece", () => {
      const { ids, tokens } = tokenizer.encode("a€b");
      expect(tokens).toEqual(["▁", "a", "<0xE2>", "<0x82>", "<0xAC>", "b"]);
      expect(ids).toEqual([1, 2, 232, 136, 178, 3]);
      expect(tokenizer.decode(ids)).toEqual("a€b");
    });

    it("emits byte tokens for each out-of-vocabulary piece", () => {
      const text = "€ £ ° + = # @";
      const { ids, tokens } = tokenizer.encode(text);
      expect(tokens).toEqual(["▁", "<0xE2>", "<0x82>", "<0xAC>", "▁", "<0xC2>", "<0xA3>", "▁", "<0xC2>", "<0xB0>", "▁", "<0x2B>", "▁", "<0x3D>", "▁", "<0x23>", "▁", "<0x40>"]);
      expect(ids).toEqual([1, 232, 136, 178, 1, 200, 169, 1, 200, 182, 1, 49, 1, 67, 1, 41, 1, 70]);
      expect(tokenizer.decode(ids)).toEqual(text);
    });

    it("handles consecutive unknown pieces and characters outside the BMP", () => {
      const text = "ab €£ 🍣ab";
      const { ids, tokens } = tokenizer.encode(text);
      expect(tokens).toEqual(["▁ab", "▁", "<0xE2>", "<0x82>", "<0xAC>", "<0xC2>", "<0xA3>", "▁", "<0xF0>", "<0x9F>", "<0x8D>", "<0xA3>", "ab"]);
      expect(ids).toEqual([5, 1, 232, 136, 178, 200, 169, 1, 246, 165, 147, 169, 4]);
      expect(tokenizer.decode(ids)).toEqual(text);
    });

    it.each(["naïve café", "寿司🍣が好き", "👩‍👩‍👧‍👦 ✨", "ab ₹8 ab", "x\u0301 \u{10FFFF}"])("round-trips %j without unknown tokens", (text) => {
      const { ids } = tokenizer.encode(text);
      expect(ids).not.toContain(0);
      expect(tokenizer.decode(ids)).toEqual(text);
    });

    it("exposes the byte tokens through the model", () => {
      const model = tokenizer.model as Unigram;
      expect(model.byte_fallback).toBe(true);
      expect(model.encode(["a€b", "ab"])).toEqual(["a", "<0xE2>", "<0x82>", "<0xAC>", "b", "ab"]);
    });

    it("keeps a literal unknown token, unless it is fused with unknown pieces", () => {
      const model = tokenizer.model as Unigram;
      expect(model.encode(["a<unk>b"])).toEqual(["a", "<unk>", "b"]);
      expect(model.encode(["€<unk>"])).toEqual(["<0xE2>", "<0x82>", "<0xAC>", "<0x3C>", "<0x75>", "<0x6E>", "<0x6B>", "<0x3E>"]);
    });
  });

  describe("enabled with missing byte tokens", () => {
    // Only the bytes of "€" are in the vocabulary (ids 6, 7 and 8)
    const tokenizer = create_tokenizer(true, ["<0xE2>", "<0x82>", "<0xAC>"]);

    it("falls back to bytes only when every byte token exists", () => {
      expect(tokenizer.encode("€").ids).toEqual([1, 6, 7, 8]);
      expect(tokenizer.encode("£").ids).toEqual([1, 0]);
    });

    it("maps a fused unknown piece to a single unknown token", () => {
      const { ids, tokens } = tokenizer.encode("a€£b x€");
      expect(tokens).toEqual(["▁", "a", "€£", "b", "▁", "x€"]);
      expect(ids).toEqual([1, 2, 0, 3, 1, 0]);
    });
  });

  describe.each([
    ["disabled", false],
    ["omitted", undefined],
  ])("%s", (_, byte_fallback) => {
    // The byte tokens are in the vocabulary, but must not be used.
    const tokenizer = create_tokenizer(byte_fallback);

    it("leaves known text unchanged", () => {
      const { ids, tokens } = tokenizer.encode(KNOWN_TEXT);
      expect(tokens).toEqual(KNOWN_TOKENS);
      expect(ids).toEqual(KNOWN_IDS);
      expect(tokenizer.decode(ids)).toEqual(KNOWN_TEXT);
    });

    it("maps unknown pieces to the unknown token", () => {
      const { ids, tokens } = tokenizer.encode("ab €£ 🍣ab");
      expect(tokens).toEqual(["▁ab", "▁", "€£", "▁", "🍣", "ab"]);
      expect(ids).toEqual([5, 1, 0, 1, 0, 4]);
      expect(tokenizer.decode(ids)).toEqual("ab <unk> <unk>ab");

      expect(tokenizer.encode("€ £ ° + = # @").ids).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
    });

    it("does not fall back to bytes in the model", () => {
      const model = tokenizer.model as Unigram;
      expect(model.byte_fallback).toBe(false);
      expect(model.encode(["a€b"])).toEqual(["a", "€", "b"]);
    });
  });
});
