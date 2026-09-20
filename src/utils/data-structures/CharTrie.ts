/**
 * Edges are keyed by packing a node index and a code point into one number, so the whole
 * trie needs a single `Map` rather than one per node.
 *
 * The largest code point is `0x10FFFF`, which fits in 21 bits, so shifting the node index
 * by that much cannot collide. The product stays an exact integer well inside
 * `Number.MAX_SAFE_INTEGER` for any realistic vocabulary: a trie would need more than
 * 2^32 nodes before the packed key lost precision.
 */
const CODE_POINT_SHIFT = 2 ** 21;

/** Initial capacity of the leaf flags array; it grows geometrically from here. */
const INITIAL_CAPACITY = 1024;

/**
 * A trie structure to efficiently store and search for strings.
 *
 * Nodes are held in flat arrays rather than as objects linked by per-node maps. A node is
 * just an integer index: `edges` maps a packed (node, code point) pair to the child index,
 * and `leaf` records which nodes terminate a stored string. For a 128k-entry SentencePiece
 * vocabulary (~278k nodes) this uses roughly a fifth of the memory an object-per-node trie
 * does, because it allocates two arrays and one map in total instead of ~278k objects and
 * ~278k maps.
 */
class CharTrie {
  /** Packed `(node, code point)` to child node index. */
  private edges: Map<number, number>;
  /** `1` where the node at that index terminates a stored string. */
  private leaf: Uint8Array;
  /** Number of allocated nodes; index `0` is the root. */
  private size: number;

  constructor() {
    this.edges = new Map();
    this.leaf = new Uint8Array(INITIAL_CAPACITY);
    this.size = 1;
  }

  /**
   * Grows the leaf flags array so `node` is addressable.
   * @param node The node index that must fit.
   */
  private reserve(node: number): void {
    if (node < this.leaf.length) return;
    const grown = new Uint8Array(Math.max(node + 1, this.leaf.length * 2));
    grown.set(this.leaf);
    this.leaf = grown;
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
    let node = 0;
    for (const ch of text) {
      const key = node * CODE_POINT_SHIFT + (ch.codePointAt(0) as number);
      let child = this.edges.get(key);
      if (child === undefined) {
        child = this.size++;
        this.reserve(child);
        this.edges.set(key, child);
      }
      node = child;
    }
    this.reserve(node);
    this.leaf[node] = 1;
  }

  /**
   * Searches the trie for stored strings that match `chars` starting at `start`.
   * @param chars The input characters to search.
   * @param start The index to start searching from.
   * @yields Each stored string that is a prefix of `chars` starting at `start`.
   */
  *common_prefix_search(chars: string[], start = 0): Generator<string> {
    let node = 0;

    let prefix = "";
    for (let i = start; i < chars.length; ++i) {
      const ch = chars[i];
      prefix += ch;
      const child = this.edges.get(
        node * CODE_POINT_SHIFT + (ch.codePointAt(0) as number),
      );
      if (child === undefined) return;
      node = child;
      if (this.leaf[node]) {
        yield prefix;
      }
    }
  }
}

export default CharTrie;
