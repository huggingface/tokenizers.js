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

  it("keeps entries distinct past its initial node capacity", () => {
    // Nodes are held in a flat array that grows geometrically, so a vocabulary large
    // enough to reallocate it several times is worth exercising: a bad copy on growth
    // would lose leaf flags for everything inserted before the last resize.
    const words = Array.from({ length: 3000 }, (_, i) => `token${i}`);
    const trie = new CharTrie();
    trie.extend(words);

    for (const word of [words[0], words[1499], words[2999]]) {
      expect([...trie.common_prefix_search(Array.from(word))]).toContain(word);
    }
    expect([...trie.common_prefix_search(Array.from("token"))]).toEqual([]);
  });

  it("treats astral characters as single units, up to the maximum code point", () => {
    // Edges are keyed per code point, not per UTF-16 unit, so a surrogate pair has to
    // traverse one edge rather than two. U+10FFFF is the top of the range the key
    // packing has to accommodate.
    const max = String.fromCodePoint(0x10ffff);
    const trie = new CharTrie();
    trie.extend(["\u{1D49C}", "\u{1D49C}b", "b", `b${max}`, max]);

    expect([...trie.common_prefix_search(Array.from("\u{1D49C}b"))]).toEqual(["\u{1D49C}", "\u{1D49C}b"]);
    expect([...trie.common_prefix_search(Array.from(`b${max}`))]).toEqual(["b", `b${max}`]);
    expect([...trie.common_prefix_search(Array.from(max))]).toEqual([max]);
    // Starting mid-sequence must not match: `Array.from` splits by code point, so index
    // 1 of a single astral character is past its end.
    expect([...trie.common_prefix_search(Array.from("\u{1D49C}"), 1)]).toEqual([]);
  });

  it("treats an empty string as stored without yielding it", () => {
    const trie = new CharTrie();
    trie.extend([""]);

    expect([...trie.common_prefix_search(Array.from("abc"))]).toEqual([]);
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
