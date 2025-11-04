// Integration test to verify all exports are available from main export
import { Tokenizer } from "../src";
import type { Encoding } from "../src";
import {
  MetaspacePreTokenizer,
  Whitespace,
  BPE,
  Lowercase,
  StripAccents,
  BPEDecoder,
  TemplateProcessing,
} from "../src";

describe("Main export integration", () => {
  it("should import Tokenizer and Encoding", () => {
    expect(Tokenizer).toBeDefined();

    // Encoding is a type-only export
    const enc: Encoding = {
      ids: [1, 2, 3],
      tokens: ["a", "b", "c"],
      attention_mask: [1, 1, 1],
    };
    expect(enc.ids).toHaveLength(3);
  });

  it("should import pre-tokenizers from main export", () => {
    expect(MetaspacePreTokenizer).toBeDefined();
    expect(Whitespace).toBeDefined();
  });

  it("should import models from main export", () => {
    expect(BPE).toBeDefined();
  });

  it("should import normalizers from main export", () => {
    expect(Lowercase).toBeDefined();
    expect(StripAccents).toBeDefined();
  });

  it("should import decoders from main export", () => {
    expect(BPEDecoder).toBeDefined();
  });

  it("should import post-processors from main export", () => {
    expect(TemplateProcessing).toBeDefined();
  });
});
