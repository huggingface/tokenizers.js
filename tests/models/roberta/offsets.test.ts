import fetchConfigById from "../../utils/fetchConfigById";
import { Tokenizer } from "../../../src";

// RoBERTa pipeline: (no normalizer) → ByteLevel → BPE → RobertaProcessing
//
// How RoBERTa differs from GPT-2 in offset terms:
//
//  1. SPECIAL TOKENS — [0, 0] sentinels
//     RobertaProcessing wraps every output with <s> and </s>. These tokens are
//     injected by the post-processor *after* encode_text runs, so they are never
//     present in `all_pairs`. tokenize_helper assigns offsets by walking `all_pairs`
//     in order and matching on token string; any token that doesn't match the next
//     pair entry falls through to [0, 0]. <s> always mismatches (it's first, before
//     any content token), and </s> always mismatches (content is exhausted).
//
//  2. TEXT PAIRS — double </s> separator, all sentinels
//     RobertaProcessing follows the convention:
//       <s> A </s> </s> B </s>
//     The two </s> tokens between A and B are both injected by the post-processor.
//     When tokenize_helper scans that region, all_pairs[pair_i] is already pointing
//     at the first B token ("good"), so neither </s> matches → both get [0, 0].
//     The closing </s> after B also gets [0, 0] (pair_i has advanced past all pairs).
//
//  3. SPACE ABSORPTION — identical to GPT-2
//     ByteLevel uses the same GPT-2 regex (' ?\p{L}+' etc.), so the space before
//     the second word is consumed by that match and included in its span start.
//     Note: ByteLevel.trim_offsets is set to true in the config but is currently
//     marked @todo in the implementation — offsets are NOT trimmed, so the space
//     remains absorbed into the following token's span start.
//
//  4. TOKEN TYPE IDs (text pairs only)
//     RobertaProcessing fills type_id=0 for all A-side tokens (including <s> and
//     the closing </s> of A), and type_id=1 for the middle </s>, all B tokens, and
//     the final </s>.

describe("RoBERTa offset mapping (BPE + ByteLevel + RobertaProcessing)", () => {
  let tokenizer: Tokenizer;

  beforeAll(async () => {
    const { tokenizerJson, tokenizerConfig } =
      await fetchConfigById("Xenova/all-distilroberta-v1");
    tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  });

  test("<s> and </s> get [0,0]; content tokens keep ByteLevel spans", () => {
    // ByteLevel regex on "Hello world":
    //   match "Hello" at index 0 → span [0, 5]
    //   match " world" at index 5 → span [5, 11]  (space absorbed into start)
    // BPE keeps both as single tokens (no sub-split for these words).
    // RobertaProcessing: <s> Hello Ġworld </s>
    //   <s>     → not in all_pairs → [0, 0]
    //   Hello   → all_pairs[0] match → [0, 5]
    //   Ġworld  → all_pairs[1] match → [5, 11]
    //   </s>    → pair_i past end → [0, 0]
    const { tokens, offsets } = tokenizer.encode("Hello world");
    expect(tokens).toEqual(["<s>", "Hello", "Ġworld", "</s>"]);
    expect(offsets).toEqual([
      [0, 0],   // <s>    — post-processor sentinel
      [0, 5],   // Hello
      [5, 11],  // Ġworld — span starts at 5, absorbing the space
      [0, 0],   // </s>   — post-processor sentinel
    ]);
  });

  test("add_special_tokens:false strips both sentinels and their [0,0] offsets", () => {
    // Without special tokens the post-processor is still called but wrapping is skipped,
    // so the output is identical to raw ByteLevel+BPE — same as GPT-2 for this input.
    const { tokens, offsets } = tokenizer.encode("Hello world", {
      add_special_tokens: false,
    });
    expect(tokens).toEqual(["Hello", "Ġworld"]);
    expect(offsets).toEqual([
      [0, 5],
      [5, 11],
    ]);
  });

  test("BPE sub-split: each piece gets its own sub-span, sentinels wrap", () => {
    // BPE splits "tokenization" into "token" (5 chars) and "ization" (7 chars).
    // BPE.encode walks a cursor: pos=0 → "token" [0,5]; pos=5 → "ization" [5,12].
    // word_start=0 (ByteLevel match starts at 0 for no-prefix-space input).
    // RobertaProcessing wraps: <s> token ization </s>
    const { tokens, offsets } = tokenizer.encode("tokenization");
    expect(tokens).toEqual(["<s>", "token", "ization", "</s>"]);
    expect(offsets).toEqual([
      [0, 0],
      [0, 5],   // "token"
      [5, 12],  // "ization"
      [0, 0],
    ]);
  });

  test("text pair — double </s> separator; both separator tokens get [0,0]", () => {
    // Single sequence: <s> Hello Ġworld </s>
    // Pair sequence:   <s> Hello Ġworld </s> </s> good Ġmorning </s>
    //
    // all_pairs = [Hello,[0,5]], [Ġworld,[5,11]], [good,[0,4]], [Ġmorning,[4,12]]
    //
    // tokenize_helper walk:
    //   <s>       → mismatch all_pairs[0]="Hello"   → [0, 0]
    //   Hello     → match all_pairs[0]              → [0, 5],  pair_i=1
    //   Ġworld    → match all_pairs[1]              → [5, 11], pair_i=2
    //   </s>      → mismatch all_pairs[2]="good"    → [0, 0]   ← end-of-A separator
    //   </s>      → mismatch all_pairs[2]="good"    → [0, 0]   ← start-of-B separator
    //   good      → match all_pairs[2]              → [0, 4],  pair_i=3
    //   Ġmorning  → match all_pairs[3]              → [4, 12], pair_i=4
    //   </s>      → pair_i == all_pairs.length      → [0, 0]   ← end-of-B sentinel
    const enc = tokenizer.encode("Hello world", {
      text_pair: "good morning",
      return_token_type_ids: true,
    });
    expect(enc.tokens).toEqual([
      "<s>", "Hello", "Ġworld", "</s>",
      "</s>", "good", "Ġmorning", "</s>",
    ]);
    expect(enc.offsets).toEqual([
      [0, 0],   // <s>
      [0, 5],   // Hello
      [5, 11],  // Ġworld
      [0, 0],   // </s>  end-of-A
      [0, 0],   // </s>  start-of-B  ← this is the extra RoBERTa separator
      [0, 4],   // good
      [4, 12],  // Ġmorning
      [0, 0],   // </s>  end-of-B
    ]);
    // A-side (including <s> and first </s>) → type_id 0
    // B-side (including both middle </s> and final </s>) → type_id 1
    expect(enc.token_type_ids).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  test("pair offset independence — B-sequence spans are relative to their own text, not A", () => {
    // Sanity check: "good morning" encoded alone vs as pair-B produces the same offsets.
    // Offsets reference the *original string passed for that sequence*, not a concatenated buffer.
    const alone = tokenizer.encode("good morning", { add_special_tokens: false });
    const pair = tokenizer.encode("Hello world", {
      text_pair: "good morning",
      add_special_tokens: false,
    });
    // pair = Hello Ġworld good Ġmorning (no sentinels)
    const pairBOffsets = pair.offsets.slice(2); // drop Hello, Ġworld
    expect(alone.offsets).toEqual(pairBOffsets);
  });
});
