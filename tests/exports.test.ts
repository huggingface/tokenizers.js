import { Tokenizer } from "../src";
import type { Encoding } from "../src";
import { MetaspacePreTokenizer, Whitespace } from "../src";
import { BPE } from "../src";

describe("Additional exports", () => {
  describe("Main exports", () => {
    it("should export Tokenizer", () => {
      expect(Tokenizer).toBeDefined();
    });

    it("should export Encoding type (compile-time test)", () => {
      // This test verifies that the Encoding type can be used
      const encoding: Encoding = {
        ids: [1, 2, 3],
        tokens: ["hello", "world", "!"],
        attention_mask: [1, 1, 1],
      };
      expect(encoding.ids).toEqual([1, 2, 3]);
    });
  });

  describe("Pre-tokenizer exports", () => {
    it("should export MetaspacePreTokenizer", () => {
      expect(MetaspacePreTokenizer).toBeDefined();
      const metaspace = new MetaspacePreTokenizer({
        type: "Metaspace",
        replacement: "▁",
        add_prefix_space: true,
      });
      expect(metaspace).toBeInstanceOf(MetaspacePreTokenizer);
    });

    it("should export Whitespace pre-tokenizer", () => {
      expect(Whitespace).toBeDefined();
      const whitespace = new Whitespace();
      expect(whitespace).toBeInstanceOf(Whitespace);
    });

    it("MetaspacePreTokenizer should work correctly", () => {
      const metaspace = new MetaspacePreTokenizer({
        type: "Metaspace",
        replacement: "▁",
        add_prefix_space: true,
      });
      const result = metaspace.pre_tokenize_text("hello world");
      expect(result).toEqual(["▁hello▁world"]);
    });

    it("Whitespace pre-tokenizer should work correctly", () => {
      const whitespace = new Whitespace();
      const result = whitespace.pre_tokenize_text("hello world!");
      expect(result).toEqual(["hello", "world", "!"]);
    });
  });

  describe("Model exports", () => {
    it("should export BPE model", () => {
      expect(BPE).toBeDefined();
    });

    it("BPE model should be instantiable", () => {
      const bpe = new BPE({
        type: "BPE",
        vocab: { a: 0, b: 1, c: 2 },
        merges: [["a", "b"]],
        unk_token: "<unk>",
        ignore_merges: false,
      });
      expect(bpe).toBeInstanceOf(BPE);
    });
  });

  describe("Integration test - import from main export", () => {
    it("should support importing everything from main export", async () => {
      // All exports should be available from the main index
      const {
        Tokenizer: T1,
        MetaspacePreTokenizer: M1,
        Whitespace: W1,
        BPE: B1,
      } = await import("../src/index");
      expect(T1).toBeDefined();
      expect(M1).toBeDefined();
      expect(W1).toBeDefined();
      expect(B1).toBeDefined();
    });
  });
});
