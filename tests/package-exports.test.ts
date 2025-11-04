// Integration test to verify package.json exports work correctly
// This simulates how a user would import from the published package

import { Tokenizer } from "@huggingface/tokenizers";
import type { Encoding } from "@huggingface/tokenizers";
import { Metaspace, Whitespace } from "@huggingface/tokenizers/pre-tokenizers";
import { BPE } from "@huggingface/tokenizers/models";
import { Lowercase, StripAccents } from "@huggingface/tokenizers/normalizers";
import { BPEDecoder } from "@huggingface/tokenizers/decoders";
import { TemplateProcessing } from "@huggingface/tokenizers/post-processors";

describe("Package exports integration", () => {
  it("should import main exports", () => {
    expect(Tokenizer).toBeDefined();
    
    // Encoding is a type-only export
    const enc: Encoding = {
      ids: [1, 2, 3],
      tokens: ["a", "b", "c"],
      attention_mask: [1, 1, 1],
    };
    expect(enc.ids).toHaveLength(3);
  });

  it("should import pre-tokenizers", () => {
    expect(Metaspace).toBeDefined();
    expect(Whitespace).toBeDefined();
  });

  it("should import models", () => {
    expect(BPE).toBeDefined();
  });

  it("should import normalizers", () => {
    expect(Lowercase).toBeDefined();
    expect(StripAccents).toBeDefined();
  });

  it("should import decoders", () => {
    expect(BPEDecoder).toBeDefined();
  });

  it("should import post-processors", () => {
    expect(TemplateProcessing).toBeDefined();
  });
});
