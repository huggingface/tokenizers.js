/**
 * A data structure which uses a trie to split a string into tokens based on a dictionary.
 * It can also use a regular expression to preprocess the input text before splitting.
 *
 * NOTE: To ensure multi-byte characters are handled correctly, we operate at byte-level instead of character-level.
 */

interface TrieNode {
  [key: string]: TrieNode | string;
  end?: string;
}

class DictionarySplitter {
  private trie: TrieNode;

  /**
   * @param dictionary The dictionary of words to use for splitting.
   */
  constructor(dictionary: string[]) {
    this.trie = this._build_trie(dictionary);
  }

  /**
   * Builds a trie from the given dictionary.
   * @param dictionary The dictionary of words to build the trie from.
   * @returns The root node of the trie.
   * @private
   */
  private _build_trie(dictionary: string[]): TrieNode {
    const trie: TrieNode = Object.create(null);
    for (const word of dictionary) {
      let node: TrieNode = trie;
      for (let i = 0; i < word.length; ++i) {
        const char = word[i];
        node = (node[char] as TrieNode) ??= Object.create(null);
      }
      node.end = word;
    }
    return trie;
  }

  /**
   * Splits the input text into tokens based on the dictionary.
   * @param text The input text to split.
   * @returns An array of tokens.
   */
  split(text: string): Array<[string, number]> {
    const result: Array<[string, number]> = [];
    const n = text.length;
    let start = 0;
    let i = 0;

    while (i < n) {
      let node: TrieNode | undefined = this.trie;
      let match: string | null = null;
      let j = i;

      while (j < n && (node = node[text[j]] as TrieNode | undefined)) {
        if (node.end) {
          // Always keep the last (i.e., longest) match.
          match = node.end;
        }
        ++j;
      }

      if (match) {
        if (i > start) {
          result.push([text.slice(start, i),start]);
        }
        result.push([match,i]);
        i += match.length;
        start = i;
      } else {
        ++i;
      }
    }
    if (start < n) {
      result.push([text.slice(start),start]);
    }
    return result;
  }
}

export default DictionarySplitter;
