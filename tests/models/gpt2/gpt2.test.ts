import fetchConfigById from "../../utils/fetchConfigById";
import { Tokenizer } from "../../../src";

describe("GPT-2 offset mapping (BPE + ByteLevel)", () => {
  let tokenizer: Tokenizer;

  beforeAll(async () => {
    const { tokenizerJson, tokenizerConfig } =
      await fetchConfigById("Xenova/gpt2");
    tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  });

  test("space is absorbed into the following token's span, not between spans", () => {
    // The GPT-2 regex uses ' ?\p{L}+', so the space at index 5 is consumed by
    // the second match — ĠWorld covers [5, 11], not [6, 11].
    const { tokens, offsets } = tokenizer.encode("Hello World");
    expect(tokens).toEqual(["Hello", "ĠWorld"]);
    expect(offsets).toEqual([
      [0, 5],   // "Hello"
      [5, 11],  // "ĠWorld" — span includes the space at index 5
    ]);
  });

  test("no special tokens means no [0,0] sentinel offsets", () => {
    // Unlike BERT, GPT-2 has no CLS/SEP; every offset is a real character span.
    const { tokens, offsets } = tokenizer.encode("Hello World");
    expect(offsets).toHaveLength(tokens.length);
    expect(offsets.every(([s, e]) => s !== 0 || e !== 0)).toBe(true);
  });

  test("BPE sub-split: each piece gets its own sub-span within the chunk", () => {
    // "trailing space   " splits into three pre-tokenizer chunks:
    //   "trailing" at [0,  8]  → BPE: ["tra"(3 chars), "iling"(5 chars)]
    //   " space"   at [8,  14] → BPE: ["Ġspace"] (single token)
    //   "   "      at [14, 17] → BPE: ["Ġ", "Ġ", "Ġ"] (one space each)
    //
    // BPE.encode walks the sub-token list with a char cursor, giving each piece
    // [word_start + pos, word_start + pos + piece_length].
    const { tokens, offsets } = tokenizer.encode("trailing space   ");
    expect(tokens).toEqual(["tra", "iling", "Ġspace", "Ġ", "Ġ", "Ġ"]);
    expect(offsets).toEqual([
      [0,  3],  // "tra"
      [3,  8],  // "iling"
      [8,  14], // "Ġspace"
      [14, 15], // first trailing space
      [15, 16], // second trailing space
      [16, 17], // third trailing space
    ]);
  });
});
