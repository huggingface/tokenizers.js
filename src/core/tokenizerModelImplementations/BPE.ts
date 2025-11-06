import TokenizerModel from "../TokenizerModel";
import { object_to_map } from "@utils/core";
import PriorityQueue from "@utils/data-structures/PriorityQueue";
import LRUCache from "@utils/data-structures/LRUCache";

import type { TokenizerConfigBPEModel } from "@static/tokenizer";

interface BPENode {
  token: string;
  bias: number;
  prev: BPENode | null;
  next: BPENode | null;
  score?: number;
  deleted?: boolean;
}

class BPE extends TokenizerModel {
  declare config: TokenizerConfigBPEModel;
  /** An array of BPE merges as strings. */
  merges: [string, string][];
  bpe_ranks: Map<string, number>;
  /** The suffix to insert between words. */
  continuing_subword_suffix: string | null;
  /** Whether to use spm byte-fallback trick (defaults to False) */
  byte_fallback: boolean;
  text_encoder?: TextEncoder;
  /** Whether or not to match tokens with the vocab before using merges. */
  ignore_merges: boolean;
  /**
   * The maximum length we should cache in a model.
   * Strings that are too long have minimal chances to cache hit anyway
   */
  max_length_to_cache: number;
  /**
   * The default capacity for a `BPE`'s internal cache.
   */
  cache_capacity: number;
  cache: LRUCache<string, string[]>;

  /**
   * Create a BPE instance.
   * @param config The configuration object for BPE.
   */
  constructor(config: TokenizerConfigBPEModel) {
    super(config);

    this.tokens_to_ids = object_to_map(config.vocab);
    this.unk_token_id = this.tokens_to_ids.get(config.unk_token)!;
    this.unk_token = config.unk_token;

    this.vocab = new Array(this.tokens_to_ids.size);
    for (const [key, value] of this.tokens_to_ids) {
      this.vocab[value] = key;
    }

    // Tokenizers >= 0.20.0 serializes BPE merges as a [string, string][] instead of a string[],
    // which resolves the ambiguity for merges containing spaces.
    const use_new_merge_format = Array.isArray(config.merges[0]);

    this.merges = use_new_merge_format
      ? (config.merges as [string, string][])
      : (config.merges as string[]).map(
          (x) => x.split(" ", 2) as [string, string],
        );

    this.bpe_ranks = new Map(this.merges.map((x, i) => [JSON.stringify(x), i]));

    this.end_of_word_suffix = config.end_of_word_suffix;

    // NOTE: `continuing_subword_suffix` is custom (to support `BlenderbotSmallTokenizer`)
    this.continuing_subword_suffix = config.continuing_subword_suffix ?? null;

    this.byte_fallback = this.config.byte_fallback ?? false;

    if (this.byte_fallback) {
      this.text_encoder = new TextEncoder();
    }

    this.ignore_merges = this.config.ignore_merges ?? false;

    this.max_length_to_cache = 256;

    this.cache_capacity = 10000;
    this.cache = new LRUCache(this.cache_capacity);
  }

  /**
   * Clears the cache.
   */
  clear_cache(): void {
    this.cache.clear();
  }

  /**
   * Apply Byte-Pair-Encoding (BPE) to a given token. Efficient heap-based priority
   * queue implementation adapted from https://github.com/belladoreai/llama-tokenizer-js.
   * @param token The token to encode.
   * @returns The BPE encoded tokens.
   */
  bpe(token: string): string[] {
    if (token.length === 0) {
      return [];
    }

    const cached = this.cache.get(token);
    if (cached !== undefined) {
      return cached;
    }

    const word = Array.from(token);
    if (this.end_of_word_suffix) {
      word[word.length - 1] += this.end_of_word_suffix;
    }

    let result: string[] = [];
    if (word.length > 1) {
      // Create a priority queue to store the nodes that will be merged.
      // The comparator function compares the scores of the nodes.
      const queue = new PriorityQueue<BPENode>((a, b) => a.score! < b.score!);

      // Construct a doubly-linked list of nodes that will be inserted into the priority queue,
      // starting with the individual characters. We also populate each node with a positional
      // bias to break ties in the priority queue.
      let starting_node: BPENode = {
        token: word[0],
        bias: 0,
        prev: null,
        next: null,
      };

      let previous_node = starting_node;
      for (let i = 1; i < word.length; ++i) {
        const current_node: BPENode = {
          bias: i / word.length, // Add fractional component to break ties
          token: word[i],
          prev: previous_node,
          next: null,
        };
        previous_node.next = current_node;
        this.add_node(queue, previous_node);
        previous_node = current_node;
      }

      while (!queue.is_empty()) {
        // Get the next node with the highest priority
        const node = queue.pop();

        // Check that this merge is still possible
        if (node.deleted || !node.next || node.next.deleted) continue;

        // Here, we mark the current node (left side of the merge) and the next node (right side of the merge) as deleted.
        // This is because they will both be replaced by a new node representing the merge result.
        node.deleted = true;
        node.next.deleted = true;

        // Next, we fix the node that comes before the current node (i.e., left side of the merge).
        if (node.prev) {
          // Make a shallow copy of the previous node
          const new_previous_node = { ...node.prev };

          // Mark the old previous node as deleted. This avoids erroneous merges later,
          // because there may still be references to this node in the priority queue.
          node.prev.deleted = true;
          node.prev = new_previous_node;

          // Update the reference of the previous node, by pointing its previous node to this new previous node.
          if (new_previous_node.prev) {
            new_previous_node.prev.next = new_previous_node;
          } else {
            // If the previous of the previous node does not exist, it means that
            // `new_previous_node` must be the new `starting_node`.
            starting_node = new_previous_node;
          }
        }

        // Create a new node which represents the result of the merge.
        const merged: BPENode = {
          token: node.token + node.next.token,
          bias: node.bias,
          prev: node.prev,
          next: node.next.next,
        };

        // We now consider where we can add the new merged node to the priority queue:
        // 1. prev <-> merged
        if (merged.prev) {
          merged.prev.next = merged;
          this.add_node(queue, merged.prev);
        } else {
          // If `merged.prev` does not exist, then `merged` must be the new `starting_node`.
          starting_node = merged;
        }

        // 2. merged <-> next
        if (merged.next) {
          merged.next.prev = merged;
          this.add_node(queue, merged);
        }
      }

      // Traverse the linked list, starting from the `starting_node`, and collect the tokens.
      for (
        let current_node: BPENode | null = starting_node;
        current_node !== null;
        current_node = current_node.next
      ) {
        result.push(current_node.token);
      }
    } else {
      result = word;
    }

    // Possibly append suffix
    if (this.continuing_subword_suffix) {
      // Do not append suffix to the last token
      for (let i = 0; i < result.length - 1; ++i) {
        result[i] += this.continuing_subword_suffix;
      }
    }

    if (token.length < this.max_length_to_cache) {
      // Save the result to the cache
      this.cache.put(token, result);
    }

    return result;
  }

  /**
   * Helper function to add a node to the priority queue.
   * @param queue
   * @param node
   */
  private add_node(queue: PriorityQueue<BPENode>, node: BPENode): void {
    // `score` is a measure of the merge priority: lower means higher priority
    // We use the BPE rank as a measure of priority (i.e., the local of the merge in the merges list)
    // We also add a fractional component to the score to break ties (with the earlier character having higher priority)
    const rank = this.bpe_ranks.get(
      JSON.stringify([node.token, node.next!.token]),
    );
    if (rank !== undefined) {
      node.score = rank + node.bias;
      queue.push(node);
    }
  }

  /**
   * Encodes the input sequence of tokens using the BPE algorithm and returns the resulting subword tokens.
   * @param tokens The input sequence of tokens to encode.
   * @returns The resulting subword tokens after applying the BPE algorithm to the input sequence of tokens.
   */
  encode(tokens: string[]): string[] {
    const output_tokens: string[] = [];

    for (const token of tokens) {
      if (this.ignore_merges && this.tokens_to_ids.has(token)) {
        output_tokens.push(token);
        continue;
      }
      const bpe_token_list = this.bpe(token);

      for (const t of bpe_token_list) {
        if (this.tokens_to_ids.has(t)) {
          output_tokens.push(t);
        } else if (this.byte_fallback) {
          const byte_tokens = Array.from(this.text_encoder!.encode(t)).map(
            (x) => `<0x${x.toString(16).toUpperCase().padStart(2, "0")}>`,
          );
          if (byte_tokens.every((x) => this.tokens_to_ids.has(x))) {
            // Ensure the byte tokens are actually in the vocabulary, otherwise
            // we fall back to the unknown token. For more information, see
            // https://github.com/huggingface/transformers/issues/28096.
            output_tokens.push(...byte_tokens);
          } else {
            output_tokens.push(this.unk_token);
          }
        } else {
          output_tokens.push(this.unk_token);
        }
      }
    }

    return output_tokens;
  }
}

export default BPE;
