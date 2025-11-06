import { Callable } from "@utils";

import type AddedToken from "./AddedToken";
import type { TokenizerConfigDecoder } from "@static/tokenizer";

/**
 * The base class for token decoders.
 */
abstract class Decoder extends Callable<[string[]], string> {
  config: TokenizerConfigDecoder;
  added_tokens: AddedToken[];
  end_of_word_suffix: string | null;
  trim_offsets?: boolean;

  /**
   * Creates an instance of `Decoder`.
   * @param config The configuration object.
   **/
  constructor(config: TokenizerConfigDecoder) {
    super();

    this.config = config;
    this.added_tokens = [];
    this.end_of_word_suffix = null;
    this.trim_offsets =
      "trim_offsets" in config ? (config.trim_offsets as boolean) : false;
  }

  /**
   * Calls the `decode` method.
   *
   * @param tokens The list of tokens.
   * @returns The decoded string.
   */
  _call(tokens: string[]): string {
    return this.decode(tokens);
  }

  /**
   * Decodes a list of tokens.
   * @param tokens The list of tokens.
   * @returns The decoded string.
   */
  decode(tokens: string[]): string {
    return this.decode_chain(tokens).join("");
  }

  /**
   * Apply the decoder to a list of tokens.
   *
   * @param tokens The list of tokens.
   * @returns The decoded list of tokens.
   */
  abstract decode_chain(tokens: string[]): string[];
}

export default Decoder;
