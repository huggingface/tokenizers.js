import { Tokenizer } from "../src";
import type { Encoding } from "../src";
import { Metaspace, Whitespace } from "../src/pre-tokenizers";
import { BPE } from "../src/models";

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
    it("should export Metaspace pre-tokenizer", () => {
      expect(Metaspace).toBeDefined();
      const metaspace = new Metaspace({
        type: "Metaspace",
        replacement: "▁",
        add_prefix_space: true,
      });
      expect(metaspace).toBeInstanceOf(Metaspace);
    });

    it("should export Whitespace pre-tokenizer", () => {
      expect(Whitespace).toBeDefined();
      const whitespace = new Whitespace();
      expect(whitespace).toBeInstanceOf(Whitespace);
    });

    it("Metaspace pre-tokenizer should work correctly", () => {
      const metaspace = new Metaspace({
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

  describe("Integration test - import paths", () => {
    it("should support the documented import syntax", async () => {
      // This test verifies that the documented import paths work
      // import { Tokenizer, Encoding } from "@huggingface/tokenizers";
      const { Tokenizer: T1 } = await import("../src/index");
      expect(T1).toBeDefined();
      // Encoding is a type-only export, so we can't test it at runtime

      // import { Metaspace, Whitespace } from "@huggingface/tokenizers/pre-tokenizers";
      const { Metaspace: M1, Whitespace: W1 } = await import(
        "../src/pre-tokenizers"
      );
      expect(M1).toBeDefined();
      expect(W1).toBeDefined();

      // import { BPE } from "@huggingface/tokenizers/models";
      const { BPE: B1 } = await import("../src/models");
      expect(B1).toBeDefined();
    });
  });
});
