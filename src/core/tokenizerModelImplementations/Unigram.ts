import TokenizerModel from "../TokenizerModel";
import CharTrie from "@utils/data-structures/CharTrie";
import TokenLattice from "@utils/data-structures/TokenLattice";
import { min } from "@utils/maths";
import { len } from "@utils/core";

import type { TokenizerConfigUnigramModel } from "@static/tokenizer";

/**
 * Class representing a Unigram tokenizer model.
 */
class Unigram extends TokenizerModel {
  scores: number[];
  bos_token: string;
  bos_token_id?: number;
  eos_token: string;
  eos_token_id?: number;
  min_score: number;
  unk_score: number;
  trie: CharTrie;

  /**
   * Create a new Unigram tokenizer model.
   * @param config The configuration object for the Unigram model.
   * @param eos_token
   */
  constructor(config: TokenizerConfigUnigramModel, eos_token: string) {
    super(config);

    const vocab_size = config.vocab.length;
    this.vocab = new Array(vocab_size);
    this.scores = new Array(vocab_size);
    for (let i = 0; i < vocab_size; ++i) {
      [this.vocab[i], this.scores[i]] = config.vocab[i];
    }

    this.unk_token_id = config.unk_id;
    this.unk_token = this.vocab[config.unk_id];

    this.tokens_to_ids = new Map(this.vocab.map((x, i) => [x, i]));
    this.bos_token = " "; // beginning of a sentence token

    this.bos_token_id = this.tokens_to_ids.get(this.bos_token); // NOTE: may be undefined
    this.eos_token = eos_token;

    this.eos_token_id = this.tokens_to_ids.get(this.eos_token);
    this.unk_token = this.vocab[this.unk_token_id];

    this.min_score = min(this.scores)[0];

    this.unk_score = this.min_score - 10.0;
    this.scores[this.unk_token_id] = this.unk_score;

    this.trie = new CharTrie();
    this.trie.extend(this.vocab);

    // NOTE: `fuse_unk` is hardcoded to true for Unigram models
    // See: https://github.com/huggingface/tokenizers/blob/b58227c7f1ccf8b73ee2268354336da56d91e492/tokenizers/src/models/unigram/model.rs#L119
    this.fuse_unk = true;
  }

  /**
   * Populates lattice nodes.
   * @param lattice The token lattice to populate with nodes.
   */
  populate_nodes(lattice: TokenLattice): void {
    const chars = lattice.chars;
    const mblen = 1;
    let begin_pos = 0;
    while (begin_pos < chars.length) {
      let has_single_node = false;

      const tokens: string[] = [];
      const sliced = chars.slice(begin_pos).join("");
      const prefixed_tokens = this.trie.common_prefix_search(sliced);
      for (const token of prefixed_tokens) {
        tokens.push(token);
        const token_id = this.tokens_to_ids.get(token)!;
        const token_score = this.scores[token_id];
        const n = len(token);
        lattice.insert(begin_pos, n, token_score, token_id);
        if (!has_single_node && n === mblen) {
          has_single_node = true;
        }
      }
      if (!has_single_node) {
        lattice.insert(begin_pos, mblen, this.unk_score, this.unk_token_id);
      }
      begin_pos += mblen;
    }
  }

  /**
   * Encodes an array of tokens into an array of subtokens using the unigram model.
   *
   * @param normalized The normalized string.
   * @returns An array of subtokens obtained by encoding the input tokens using the unigram model.
   */
  tokenize(normalized: string): string[] {
    const lattice = new TokenLattice(
      normalized,
      this.bos_token_id,
      this.eos_token_id,
    );
    this.populate_nodes(lattice);
    return lattice.tokens();
  }

  /**
   * Encodes an array of tokens using Unigram encoding.
   * @param tokens The tokens to encode.
   * @returns An array of encoded tokens.
   */
  encode(tokens: string[]): string[] {
    const to_return: string[] = [];
    for (const token of tokens) {
      const tokenized = this.tokenize(token);
      to_return.push(...tokenized);
    }
    return to_return;
  }
}

export default Unigram;
