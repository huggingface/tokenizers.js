/**
 * Represents a node in a character trie.
 */
class CharTrieNode {
  is_leaf: boolean;
  children: Map<string, CharTrieNode>;

  /**
   * Create a new CharTrieNode.
   * @param is_leaf Whether the node is a leaf node or not.
   * @param children A map containing the node's children, where the key is a character and the value is a `CharTrieNode`.
   */
  constructor(is_leaf: boolean, children: Map<string, CharTrieNode>) {
    this.is_leaf = is_leaf;
    this.children = children;
  }

  /**
   * Returns a new `CharTrieNode` instance with default values.
   * @returns A new `CharTrieNode` instance with `is_leaf` set to `false` and an empty `children` map.
   */
  static default(): CharTrieNode {
    return new CharTrieNode(false, new Map());
  }
}

/**
 * A trie structure to efficiently store and search for strings.
 */
class CharTrie {
  root: CharTrieNode;

  constructor() {
    this.root = CharTrieNode.default();
  }

  /**
   * Adds one or more `texts` to the trie.
   * @param texts The strings to add to the trie.
   */
  extend(texts: string[]): void {
    for (const text of texts) {
      this.push(text);
    }
  }

  /**
   * Adds text to the trie.
   * @param text The string to add to the trie.
   */
  push(text: string): void {
    let node = this.root;
    for (const ch of text) {
      let child = node.children.get(ch);
      if (child === undefined) {
        child = CharTrieNode.default();
        node.children.set(ch, child);
      }
      node = child;
    }
    node.is_leaf = true;
  }

  /**
   * Searches the trie for stored strings that match `chars` starting at `start`.
   * @param chars The input characters to search.
   * @param start The index to start searching from.
   * @yields Each stored string that is a prefix of `chars` starting at `start`.
   */
  *common_prefix_search(chars: string[], start = 0): Generator<string> {
    let node: CharTrieNode | undefined = this.root;
    if (node === undefined) return;

    let prefix = "";
    for (let i = start; i < chars.length; ++i) {
      const ch = chars[i];
      prefix += ch;
      node = node.children.get(ch);
      if (node === undefined) return;
      if (node.is_leaf) {
        yield prefix;
      }
    }
  }
}

export default CharTrie;
