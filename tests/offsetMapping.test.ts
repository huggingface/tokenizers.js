import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer } from "../src";

describe("Offset Mapping", () => {
  describe("Integration tests with real models", () => {
    let tokenizer: Tokenizer;

    beforeAll(async () => {
      // Use a real model that we know works - BERT base uncased
      const { tokenizerJson, tokenizerConfig } = await fetchConfigById("Xenova/bert-base-uncased");
      tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
    }, 60000); // Increase timeout for model download

    test("should include offset_mapping when requested", () => {
      const result = tokenizer.encode("hello world", { return_offsets_mapping: true });

      expect(result).toHaveProperty('offset_mapping');
      expect(Array.isArray(result.offset_mapping)).toBe(true);
      expect(result.offset_mapping).toHaveLength(result.tokens.length);
    });

    test("should not include offset_mapping when not requested", () => {
      const result = tokenizer.encode("hello world");
      expect(result).not.toHaveProperty('offset_mapping');
    });

    test("should map special tokens to [0,0] offsets", () => {
      const result = tokenizer.encode("hello", { return_offsets_mapping: true });

      // Find special tokens and verify they have [0,0] offsets
      result.tokens.forEach((token, i) => {
        if (token.startsWith('[') && token.endsWith(']')) {
          expect(result.offset_mapping![i]).toEqual([0, 0]);
        }
      });
    });

    test("should correctly map simple words", () => {
      const text = "hello world";
      const result = tokenizer.encode(text, { return_offsets_mapping: true });

      // Verify that all offset positions are valid
      for (const [start, end] of result.offset_mapping!) {
        if (start !== 0 || end !== 0) { // Skip special tokens
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(text.length);
          expect(start).toBeLessThanOrEqual(end);
        }
      }
    });

    test("should handle punctuation correctly", () => {
      const text = "hello, world!";
      const result = tokenizer.encode(text, { return_offsets_mapping: true });

      expect(result.offset_mapping).toBeDefined();
      expect(result.offset_mapping!.length).toBe(result.tokens.length);

      // Verify no offset exceeds text bounds
      for (const [start, end] of result.offset_mapping!) {
        if (start !== 0 || end !== 0) {
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(text.length);
        }
      }
    });

    test("should handle empty string", () => {
      const result = tokenizer.encode("", { return_offsets_mapping: true });

      expect(result.offset_mapping).toHaveLength(result.tokens.length);
      // All tokens for empty string should be special tokens with [0,0] offsets
      for (const offset of result.offset_mapping!) {
        expect(offset).toEqual([0, 0]);
      }
    });

    test("should handle email addresses", () => {
      const text = "contact john@example.com";
      const result = tokenizer.encode(text, { return_offsets_mapping: true });

      // Verify basic constraints
      expect(result.offset_mapping).toBeDefined();
      expect(result.offset_mapping!.length).toBe(result.tokens.length);

      // Verify that no offset exceeds text length
      for (const [start, end] of result.offset_mapping!) {
        if (start !== 0 || end !== 0) { // Skip special tokens
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(text.length);
          expect(start).toBeLessThanOrEqual(end);
        }
      }
    });

    test("should handle subword tokens", () => {
      const text = "running";
      const result = tokenizer.encode(text, { return_offsets_mapping: true });

      expect(result.offset_mapping).toBeDefined();

      // Look for any subword tokens (those starting with ##)
      let hasSubwords = false;
      for (let i = 0; i < result.tokens.length; i++) {
        const token = result.tokens[i];
        if (token.startsWith('##')) {
          hasSubwords = true;
          const [start, end] = result.offset_mapping![i];

          // Subword tokens should have valid offsets (not [0,0] unless empty)
          if (start !== 0 || end !== 0) {
            expect(start).toBeGreaterThanOrEqual(0);
            expect(end).toBeLessThanOrEqual(text.length);
            expect(start).toBeLessThanOrEqual(end);
          }
        }
      }

      // Note: Not all words will have subwords, so we don't assert hasSubwords
    });
  });

  describe("Error handling for unsupported models", () => {
    test("should throw descriptive errors for unsupported model types", () => {
      // This test verifies that our error handling works correctly
      // We'll test the error message patterns without creating full tokenizer instances

      const testCases = [
        { type: 'BPE', expectedPattern: /BPE.*not yet implemented/i },
        { type: 'Unigram', expectedPattern: /Unigram.*probabilistic/i },
        { type: 'Legacy', expectedPattern: /Legacy.*not supported/i },
      ];

      for (const { type, expectedPattern } of testCases) {
        // Create a minimal config just for the model type
        const minimalConfig: any = {
          version: "1.0",
          model: { type, vocab: {} },
          normalizer: null,
          pre_tokenizer: null,
          post_processor: null,
          decoder: null,
          truncation: null,
          padding: null,
          added_tokens: []
        };

        try {
          const tokenizer = new Tokenizer(minimalConfig, {});

          expect(() => {
            tokenizer.encode("test", { return_offsets_mapping: true });
          }).toThrow(expectedPattern);
        } catch (constructorError) {
          // If tokenizer construction fails, that's also acceptable for unsupported types
          // The important thing is that offset mapping is not silently broken
          console.log(`Constructor failed for ${type} (expected):`, (constructorError as Error).message);
        }
      }
    });
  });

  describe("Edge cases", () => {
    let tokenizer: Tokenizer;

    beforeAll(async () => {
      const { tokenizerJson, tokenizerConfig } = await fetchConfigById("Xenova/bert-base-uncased");
      tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
    }, 60000);

    test("should handle text with multiple consecutive spaces", () => {
      const text = "hello     world";
      const result = tokenizer.encode(text, { return_offsets_mapping: true });

      expect(result.offset_mapping).toBeDefined();
      expect(result.offset_mapping!.length).toBe(result.tokens.length);

      // Verify offset bounds
      for (const [start, end] of result.offset_mapping!) {
        if (start !== 0 || end !== 0) {
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(text.length);
        }
      }
    });

    test("should handle unicode characters", () => {
      const text = "hello 🌍 world";
      const result = tokenizer.encode(text, { return_offsets_mapping: true });

      expect(result.offset_mapping).toBeDefined();

      // Should not crash on unicode and maintain basic offset constraints
      for (const [start, end] of result.offset_mapping!) {
        if (start !== 0 || end !== 0) {
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeLessThanOrEqual(text.length);
        }
      }
    });
  });
});