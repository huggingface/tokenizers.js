/**
 * Represents a node in a token lattice.
 */
class TokenLatticeNode {
  token_id: number;
  node_id: number;
  pos: number;
  length: number;
  score: number;
  prev: TokenLatticeNode | null;
  backtrace_score: number;

  /**
   * Represents a node in a token lattice for a given sentence.
   * @param token_id The ID of the token associated with this node.
   * @param node_id The ID of this node.
   * @param pos The starting position of the token in the sentence.
   * @param length The length of the token.
   * @param score The score associated with the token.
   */
  constructor(
    token_id: number,
    node_id: number,
    pos: number,
    length: number,
    score: number,
  ) {
    this.token_id = token_id;
    this.node_id = node_id;
    this.pos = pos;
    this.length = length;
    this.score = score;
    this.prev = null;
    this.backtrace_score = 0.0;
  }

  /**
   * Returns a clone of this node.
   * @returns A clone of this node.
   */
  clone(): TokenLatticeNode {
    const n = new TokenLatticeNode(
      this.token_id,
      this.node_id,
      this.pos,
      this.length,
      this.score,
    );
    n.prev = this.prev;
    n.backtrace_score = this.backtrace_score;
    return n;
  }
}

/**
 * A lattice data structure to be used for tokenization.
 */
class TokenLattice {
  chars: string[];
  len: number;
  bos_token_id?: number;
  eos_token_id?: number;
  nodes: TokenLatticeNode[];
  begin_nodes: TokenLatticeNode[][];
  end_nodes: TokenLatticeNode[][];

  /**
   * Creates a new TokenLattice instance.
   *
   * @param sentence The input sentence to be tokenized.
   * @param bos_token_id The beginning-of-sequence token ID.
   * @param eos_token_id The end-of-sequence token ID.
   */
  constructor(sentence: string, bos_token_id?: number, eos_token_id?: number) {
    this.chars = Array.from(sentence);
    this.len = this.chars.length;
    this.bos_token_id = bos_token_id;
    this.eos_token_id = eos_token_id;
    this.nodes = [];
    this.begin_nodes = Array.from(
      { length: this.len + 1 },
      (): Array<any> => [],
    );
    this.end_nodes = Array.from({ length: this.len + 1 }, (): Array<any> => []);

    const bos = new TokenLatticeNode(this.bos_token_id ?? 0, 0, 0, 0, 0.0);
    const eos = new TokenLatticeNode(
      this.eos_token_id ?? 0,
      1,
      this.len,
      0,
      0.0,
    );
    this.nodes.push(bos.clone());
    this.nodes.push(eos.clone());
    this.begin_nodes[this.len].push(eos);
    this.end_nodes[0].push(bos);
  }

  /**
   * Inserts a new token node into the token lattice.
   *
   * @param pos The starting position of the token.
   * @param length The length of the token.
   * @param score The score of the token.
   * @param token_id The token ID of the token.
   */
  insert(pos: number, length: number, score: number, token_id: number): void {
    const node_id = this.nodes.length;
    const node = new TokenLatticeNode(token_id, node_id, pos, length, score);
    this.begin_nodes[pos].push(node);
    this.end_nodes[pos + length].push(node);
    this.nodes.push(node);
  }

  /**
   * Implements the Viterbi algorithm to compute the most likely sequence of tokens.
   *
   * @returns The most likely sequence of tokens.
   */
  viterbi(): TokenLatticeNode[] {
    const len = this.len;
    let pos = 0;
    while (pos <= len) {
      if (this.begin_nodes[pos].length == 0) {
        return [];
      }
      for (let rnode of this.begin_nodes[pos]) {
        rnode.prev = null;
        let best_score = 0.0;
        let best_node: TokenLatticeNode | null = null;
        for (let lnode of this.end_nodes[pos]) {
          const score = lnode.backtrace_score + rnode.score;
          if (best_node === null || score > best_score) {
            best_node = lnode.clone();
            best_score = score;
          }
        }

        if (best_node !== null) {
          rnode.prev = best_node;
          rnode.backtrace_score = best_score;
        } else {
          return [];
        }
      }
      ++pos;
    }

    const results: TokenLatticeNode[] = [];
    const root = this.begin_nodes[len][0];
    const prev = root.prev;
    if (prev === null) {
      return [];
    }

    let node = prev.clone();
    while (node.prev !== null) {
      results.push(node.clone());
      const n = node.clone();
      node = n.prev.clone();
    }

    results.reverse();
    return results;
  }

  /**
   * Get the text piece for a given node.
   * @param node The node to get the piece for.
   * @returns The array of nodes representing the most likely sequence of tokens.
   */
  piece(node: TokenLatticeNode): string {
    return this.chars.slice(node.pos, node.pos + node.length).join("");
  }

  /**
   * @returns The most likely sequence of tokens.
   */
  tokens(): string[] {
    const nodes = this.viterbi();
    return nodes.map((x) => this.piece(x));
  }

  /**
   * @returns The most likely sequence of tokens with their character spans.
   */
  token_spans(): Array<[string, [number, number]]> {
    const nodes = this.viterbi();
    return nodes.map((x) => [this.piece(x), [x.pos, x.pos + x.length]]);
  }

  /**
   * @returns The most likely sequence of token ids.
   */
  token_ids(): number[] {
    const nodes = this.viterbi();
    return nodes.map((x) => x.token_id);
  }
}

export default TokenLattice;
