import { Unigram } from "../src";
import CharTrie from "../src/utils/data-structures/CharTrie";

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
