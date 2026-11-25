import { Callable } from "@utils";
import { fuse_unk } from "@utils/core";

import type { TokenizerModelConfig } from "@static/tokenizer";

/**
 * Abstract base class for tokenizer models.
 */
abstract class TokenizerModel extends Callable<[string[]], string[]> {
  config: TokenizerModelConfig;
  vocab: string[];
  /** A mapping of tokens to ids. */
  tokens_to_ids: Map<string, number>;
  unk_token_id?: number;
  unk_token?: string;
  end_of_word_suffix?: string;
  /** Whether to fuse unknown tokens when encoding. Defaults to false. */
  fuse_unk: boolean;

  /**
   * Creates a new instance of TokenizerModel.
   * @param config The configuration object for the TokenizerModel.
   */
  constructor(config: TokenizerModelConfig) {
    super();
    this.config = config;
    this.vocab = [];
    this.tokens_to_ids = new Map();
    this.unk_token_id = undefined;
    this.unk_token = undefined;
    this.end_of_word_suffix = undefined;
    this.fuse_unk = (this.config as any).fuse_unk ?? false;
  }

  /**
   * Internal function to call the TokenizerModel instance.
   * @param tokens The tokens to encode.
   * @returns The encoded tokens.
   */
  _call(tokens: string[]): string[] {
    if (!this.fuse_unk) {
      return this.encode(tokens);
    }

    // Unknown tokens are only fused within a single word (pre-token), never across word
    // boundaries, so every word has to be encoded and fused on its own.
    const result: string[] = [];
    for (const token of tokens) {
      const encoded = this.encode([token]);
      // A single token has nothing to fuse with.
      const fused =
        encoded.length > 1
          ? fuse_unk(encoded, this.tokens_to_ids, this.unk_token_id)
          : encoded;
      for (const t of fused) {
        result.push(t);
      }
    }
    return result;
  }

  /**
   * Encodes a list of tokens into a list of token IDs.
   * @param tokens The tokens to encode.
   * @returns The encoded tokens.
   */
  abstract encode(tokens: string[]): string[];
}

export default TokenizerModel;
