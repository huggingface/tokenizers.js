import Decoder from "../Decoder";

import type { TokenizerConfigDecoderByteFallback } from "@static/tokenizer";

class ByteFallback extends Decoder {
  text_decoder: TextDecoder;

  constructor(config: TokenizerConfigDecoderByteFallback) {
    super(config);

    this.text_decoder = new TextDecoder();
  }

  decode_chain(tokens: string[]): string[] {
    const new_tokens: string[] = [];
    let previous_byte_tokens: number[] = [];

    for (const token of tokens) {
      let bytes: number | null = null;
      if (
        token.length === 6 &&
        token.startsWith("<0x") &&
        token.endsWith(">")
      ) {
        const byte = parseInt(token.slice(3, 5), 16);
        if (!isNaN(byte)) {
          bytes = byte;
        }
      }
      if (bytes !== null) {
        previous_byte_tokens.push(bytes);
      } else {
        if (previous_byte_tokens.length > 0) {
          const string = this.text_decoder.decode(
            Uint8Array.from(previous_byte_tokens),
          );
          new_tokens.push(string);
          previous_byte_tokens = [];
        }
        new_tokens.push(token);
      }
    }
    if (previous_byte_tokens.length > 0) {
      const string = this.text_decoder.decode(
        Uint8Array.from(previous_byte_tokens),
      );
      new_tokens.push(string);
      previous_byte_tokens = [];
    }

    return new_tokens;
  }
}

export default ByteFallback;
