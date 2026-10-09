// tests/models/bert/offsets.test.ts
import fetchConfigById from "../../utils/fetchConfigById";
import { Tokenizer } from "../../../src";

describe("BERT offset mapping", () => {
  let tokenizer: Tokenizer;

  beforeAll(async () => {
    const { tokenizerJson, tokenizerConfig } =
      await fetchConfigById("Xenova/bert-base-uncased");
    tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
  });

  test("Hello World — special tokens get [0,0], words get character spans", () => {
    const { tokens, offsets } = tokenizer.encode("Hello World");
    expect(tokens).toEqual(["[CLS]", "hello", "world", "[SEP]"]);
    expect(offsets).toEqual([[0, 0], [0, 5], [6, 11], [0, 0]]);
  });

  test("text pair — B-sequence offsets are independent of A", () => {
    const { tokens, offsets } = tokenizer.encode("hello", {
      text_pair: "world",
    });
    // [CLS] hello [SEP] world [SEP]
    expect(offsets).toEqual([[0, 0], [0, 5], [0, 0], [0, 5], [0, 0]]);
  });

  test("subword split preserves character-level spans", async () => {
    // bert-base-cased: "Héllo" → H + ##é + ##llo
    const { tokenizerJson: cJson, tokenizerConfig: cCfg } =
      await fetchConfigById("Xenova/bert-base-cased");
    const cased = new Tokenizer(cJson, cCfg);
    const { offsets } = cased.encode("Héllo");
    // [CLS] H ##é ##llo [SEP]
    expect(offsets).toEqual([[0,0], [0,1], [1,2], [2,5], [0,0]]);
  });
});
