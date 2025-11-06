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
    let result = this.encode(tokens);
    if (this.fuse_unk) {
      result = fuse_unk(result, this.tokens_to_ids, this.unk_token_id);
    }
    return result;
  }

  /**
   * Encodes a list of tokens into a list of token IDs.
   * @param tokens The tokens to encode.
   * @returns The encoded tokens.
   */
  abstract encode(tokens: string[]): string[];

  /**
   * Converts a list of tokens into a list of token IDs.
   * @param tokens The tokens to convert.
   * @returns The converted token IDs.
   */
  convert_tokens_to_ids(tokens: string[]): number[] {
    return tokens.map((t) => {
      return this.tokens_to_ids.get(t) ?? this.unk_token_id!;
    });
  }

  /**
   * Converts a list of token IDs into a list of tokens.
   * @param ids The token IDs to convert.
   * @returns The converted tokens.
   */
  convert_ids_to_tokens(ids: number[] | bigint[]): string[] {
    return ids.map((i) => this.vocab[Number(i)] ?? this.unk_token!);
  }
}

export default TokenizerModel;
