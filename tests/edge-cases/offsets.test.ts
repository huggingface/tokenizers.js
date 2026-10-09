import fetchConfigById from "../utils/fetchConfigById";
import { Tokenizer } from "../../src";

// ─── Why each case is dangerous for offset tracking ────────────────────────────
//
// 1. EMPTY STRING
//    encode_text("") → DictionarySplitter.split("") → [] (n=0, while-loop never runs).
//    all_pairs is empty, so every token in the post-processor output mismatches the
//    pair walk and receives [0, 0]. The risk: callers that iterate over offsets and
//    subtract start from end to get a character count would get 0, which is correct,
//    but callers that assume at least one real span exists would read a stale pair_i.
//
// 2. WHITESPACE-ONLY STRING
//    encode_text("   ") → DictionarySplitter gives one non-empty section "   ".
//    BertNormalizer produces "   " (clean_text maps whitespace to ASCII space).
//    BertPreTokenizer: text.trim() = "", matchAll on "" → []. Model receives [].
//    processed_text is non-empty (length=3 > 0) so the early-exit at line 299 doesn't
//    fire — the code reaches the model and just produces nothing. all_pairs = [].
//    Risk: a naive check `if (!pairs1.length) early-return` would be wrong; the code
//    must allow the post-processor to still run (and produce its sentinels).
//
// 3. ACCENTED INPUT (NFC) — "cafe\u0301" stripped to "cafe"
//    Two Unicode forms of the same word produce different alignment maps and
//    therefore different end-offsets for the same logical token:
//
//    NFC "café" (4 chars, precomposed):
//      BertNormalizer: NFD(é)="é", strip Mn → "e". Result: "cafe" (4 chars).
//      build_alignment_map("café", "cafe"):
//        'c','a','f' match via Case 1. Then orig='é', norm='e':
//          Case 1 fails ('é' !== 'e', toLowerCase same).
//          Case 2: NFD('é')="é" (2 chars) not found in normalized "cafe" at [3..5].
//          Case 3: orig_i+2=5 > length=4, break.
//          Case 4 DELETION: orig_i++ (skips 'é'), norm_i stays.
//        Next iter: orig_i=4 >= length=4 → map[3] = 4.
//      alignment=[0,1,2,4]. to_orig(0,4): sec_end=alignment[4] OOB → original.length=4 → [0,4].
//
//    NFD "cafe\u0301" (5 chars, decomposed — must use \u escape, V8 normalizes literals):
//      BertNormalizer: NFD("cafe\u0301")="cafe\u0301", strip Mn → "cafe" (4 chars).
//      build_alignment_map("cafe\u0301", "cafe"):
//        'c','a','f': Case 1. Then orig='e', norm='e': Case 1 MATCHES → map[3]=3.
//        Loop exits at norm_i=4; combining accent at orig[4] is NEVER consumed.
//      alignment=[0,1,2,3]. to_orig(0,4): sec_end=alignment[4] OOB → original.length=5 → [0,5].
//
//    Same semantic text, same token "cafe", but NFC→[0,4] and NFD→[0,5].
//
// 4. TEXT PAIR — B-sequence offsets are independent; [SEP] between gets [0, 0]
//    BertProcessing pair: [CLS] A [SEP] B [SEP]  (one separator, unlike RoBERTa's two).
//    all_pairs = pairs1 ++ pairs2. tokenize_helper's offset walk:
//      [CLS] mismatches all_pairs[0] → [0, 0].
//      A tokens match consecutively.
//      [SEP] mismatches all_pairs[pair_i] which is the first B token → [0, 0].
//      B tokens match. Their offsets come from encode_text(text_pair) independently:
//        positions are relative to text_pair, not to text.
//      Final [SEP] → pair_i exhausted → [0, 0].
//
// 5. SPECIAL TOKEN EMBEDDED IN TEXT — "hello [SEP] world" with BERT
//    DictionarySplitter (unnormalized pass) recognises "[SEP]" as an added token.
//    sections = [("hello ", 0), ("[SEP]", 6), (" world", 11)].
//    encode_text returns:
//      ("hello", [0, 5])   — from the "hello " section
//      ("[SEP]", [6, 11])  — added_tokens_map hit, span = [offset, offset+len]
//      ("world", [12, 17]) — from the " world" section, section_offset=11
//    all_pairs has all three entries. Post-processor: [CLS] hello [SEP] world [SEP].
//    Offset walk (sequential string-match):
//      [CLS]  → mismatch all_pairs[0]="hello" → [0, 0]
//      hello  → match                          → [0, 5]
//      [SEP]  → all_pairs[1][0]="[SEP]" MATCHES → [6, 11]  ← real offset
//      world  → match                          → [12, 17]
//      [SEP]  → pair_i=3 = all_pairs.length   → [0, 0]     ← sentinel
//    The in-text [SEP] is distinguishable from the post-processor [SEP] only by
//    sequential position in the token stream, not by any flag on the token string.

describe("Offset edge cases (BERT)", () => {
  let uncased: Tokenizer;

  beforeAll(async () => {
    const { tokenizerJson, tokenizerConfig } =
      await fetchConfigById("Xenova/bert-base-uncased");
    uncased = new Tokenizer(tokenizerJson, tokenizerConfig);
  });

  // ── 1. Empty string ───────────────────────────────────────────────────────────

  test("empty string — only sentinels, both [0, 0]", () => {
    // DictionarySplitter.split("") → [] → all_pairs = []. Every post-processor
    // token mismatches the pair walk → all offsets are the [0, 0] sentinel.
    const { tokens, offsets } = uncased.encode("");
    expect(tokens).toEqual(["[CLS]", "[SEP]"]);
    expect(offsets).toEqual([[0, 0], [0, 0]]);
  });

  // ── 2. Whitespace-only string ─────────────────────────────────────────────────

  test("whitespace-only string — BertPreTokenizer produces nothing, sentinels only", () => {
    // encode_text("   ") reaches the model with an empty token list because
    // BertPreTokenizer's text.trim() = "" — but processed_text.length=3 is non-zero
    // so the early-exit guard doesn't fire. all_pairs = [].
    const { tokens, offsets } = uncased.encode("   ");
    expect(tokens).toEqual(["[CLS]", "[SEP]"]);
    expect(offsets).toEqual([[0, 0], [0, 0]]);
  });

  // ── 3. Accented input ─────────────────────────────────────────────────────────

  test("NFC accent — Case 4 deletion fires; whole-token offset correctly spans original", () => {
    // "café" (4 chars, precomposed e-acute). BertNormalizer strips accent → "cafe".
    // build_alignment_map: 'é' fails Cases 1-3 → Case 4 deletion (orig_i++).
    //   Next iter: orig_i=4 >= length=4 → map[3] = original.length = 4.
    //   alignment = [0, 1, 2, 4].
    // to_orig(0, 4): alignment[4] OOB → sec_end = original_section.length = 4 → [0, 4].
    // The full token correctly spans the original word even though 'e-acute' couldn't
    // be individually aligned — only the whole-word span is reliable when Case 4 fires.
    const { tokens, offsets } = uncased.encode("café");  // NFC precomposed
    expect(tokens).toEqual(["[CLS]", "cafe", "[SEP]"]);
    expect(offsets).toEqual([
      [0, 0],
      [0, 4],  // whole "cafe" maps back to original [0,4] = "café"
      [0, 0],
    ]);
  });

  test("NFD accent — combining mark un-consumed; end overflows to original.length=5", () => {
    // "cafe\u0301" (5 chars: c,a,f,e, combining-acute). Must use \u escape — V8
    // normalizes source-file NFD string literals to NFC at parse time.
    //
    // BertNormalizer: strip Mn removes ́ → "cafe" (4 chars).
    // build_alignment_map("cafe\u0301", "cafe"):
    //   'c','a','f': Case 1, orig_i=3, norm_i=3.
    //   orig[3]='e', norm[3]='e': Case 1 MATCHES → map[3]=3, orig_i=4, norm_i=4.
    //   Loop exits. Combining accent at orig[4] is NEVER consumed.
    //   alignment = [0, 1, 2, 3].
    // to_orig(0, 4): alignment[4] OOB → sec_end = original_section.length = 5 → [0, 5].
    // NFC and NFD of the same word produce different end-offsets: [0,4] vs [0,5].
    const nfd = "cafe\u0301";  // explicit NFD: 5 JS chars
    const { tokens, offsets } = uncased.encode(nfd);
    expect(tokens).toEqual(["[CLS]", "cafe", "[SEP]"]);
    expect(offsets).toEqual([
      [0, 0],
      [0, 5],  // end=5: spans 'e' (orig[3]) AND the unconsumed combining accent (orig[4])
      [0, 0],
    ]);
  });

  // ── 4. Text pair ──────────────────────────────────────────────────────────────

  test("text pair — B spans are independent of A; single [SEP] separator gets [0, 0]", () => {
    // Structure: [CLS] A [SEP] B [SEP]
    // The [SEP] between A and B is injected by BertProcessing — not in all_pairs.
    // When the offset walk hits it, all_pairs[pair_i] = first-B-token != "[SEP]" → [0, 0].
    // B-sequence offsets come from encode_text("world") independently:
    //   "world" → [0, 5] relative to text_pair, not concatenated after text.
    const enc = uncased.encode("hello", {
      text_pair: "world",
      return_token_type_ids: true,
    });
    expect(enc.tokens).toEqual(["[CLS]", "hello", "[SEP]", "world", "[SEP]"]);
    expect(enc.offsets).toEqual([
      [0, 0],   // [CLS]
      [0, 5],   // hello — from encode_text("hello")
      [0, 0],   // [SEP] separator — post-processor sentinel
      [0, 5],   // world — from encode_text("world"), independent of A's positions
      [0, 0],   // [SEP] — post-processor sentinel
    ]);
    // A-side tokens → type_id 0; B-side tokens → type_id 1.
    expect(enc.token_type_ids).toEqual([0, 0, 0, 1, 1]);
  });

  // ── 5. Special token embedded in text ────────────────────────────────────────

  test("[SEP] embedded in text gets its real character span", () => {
    // "hello [SEP] world" (length 17).
    // DictionarySplitter (unnormalized) splits on "[SEP]":
    //   sections = [("hello ", 0), ("[SEP]", 6), (" world", 11)]
    // encode_text emits:
    //   ("hello",  [0,  5])  — from "hello " section
    //   ("[SEP]",  [6,  11]) — added_tokens_map hit; span = [offset, offset+len]
    //   ("world",  [12, 17]) — section_offset=11, "world" at position 1 in " world"
    // Post-processor: [CLS] hello [SEP] world [SEP]
    // Offset walk (sequential string-match, not by token type):
    //   [CLS]  → mismatch all_pairs[0]="hello"   → [0, 0]
    //   hello  → match                            → [0, 5]
    //   [SEP]  → all_pairs[1][0]="[SEP]" MATCHES → [6, 11]  ← real span from text
    //   world  → match                            → [12, 17]
    //   [SEP]  → pair_i exhausted                → [0, 0]    ← post-processor sentinel
    const { tokens, offsets } = uncased.encode("hello [SEP] world");
    expect(tokens).toEqual(["[CLS]", "hello", "[SEP]", "world", "[SEP]"]);
    expect(offsets).toEqual([
      [0, 0],    // [CLS]
      [0, 5],    // hello
      [6, 11],   // [SEP] from text — real span, not sentinel
      [12, 17],  // world
      [0, 0],    // [SEP] from post-processor — sentinel
    ]);
  });

  test("[SEP] embedded in text with add_special_tokens:false — all spans are real", () => {
    // Without special tokens, the post-processor does not wrap, so the output is
    // exactly the three pairs from encode_text — all in all_pairs, all matching.
    const { tokens, offsets } = uncased.encode("hello [SEP] world", {
      add_special_tokens: false,
    });
    expect(tokens).toEqual(["hello", "[SEP]", "world"]);
    expect(offsets).toEqual([
      [0, 5],
      [6, 11],
      [12, 17],
    ]);
  });
});
