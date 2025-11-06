import Decoder from "../Decoder";
import { UNICODE_TO_BYTES } from "@static/constants";

import type { TokenizerConfigDecoderByteLevel } from "@static/tokenizer";

/**
 * Byte-level decoder for tokenization output. Inherits from the `Decoder` class.
 */
class ByteLevel extends Decoder {
  byte_decoder: Record<string, number>;
  text_decoder: TextDecoder;

  /**
   * Create a `ByteLevelDecoder` object.
   */
  constructor(config: TokenizerConfigDecoderByteLevel) {
    super(config);

    this.byte_decoder = UNICODE_TO_BYTES;
    this.text_decoder = new TextDecoder("utf-8", {
      fatal: false,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ignoreBOM: true,
    });

    this.end_of_word_suffix = null;
  }

  /**
   * Convert an array of tokens to string by decoding each byte.
   * @param tokens Array of tokens to be decoded.
   * @returns The decoded string.
   */
  convert_tokens_to_string(tokens: string[]): string {
    const text = tokens.join("");
    const byte_array = new Uint8Array(
      [...text].map((c) => this.byte_decoder[c]),
    );
    return this.text_decoder.decode(byte_array);
  }

  decode_chain(tokens: string[]): string[] {
    // TODO move to base class (like HF)
    // tokens === filtered_tokens

    // To avoid mixing byte-level and unicode for byte-level BPT
    // we need to build string separately for added tokens and byte-level tokens
    // cf. https://github.com/huggingface/transformers/issues/1133
    const sub_texts: string[] = [];
    let current_sub_text: string[] = [];
    for (const token of tokens) {
      // tokens sent here are already filtered, so we don't need to do this
      // if (skip_special_tokens && this.all_special_ids.includes(token)) {
      //     continue;
      // }

      if (this.added_tokens.find((x) => x.content === token) !== undefined) {
        if (current_sub_text.length > 0) {
          sub_texts.push(this.convert_tokens_to_string(current_sub_text));
          current_sub_text = [];
        }
        sub_texts.push(token);
      } else {
        current_sub_text.push(token);
      }
    }
    if (current_sub_text.length > 0) {
      sub_texts.push(this.convert_tokens_to_string(current_sub_text));
    }

    // TODO add spaces_between_special_tokens and clean_up_tokenization_spaces options

    return sub_texts;
  }
}

export default ByteLevel;
