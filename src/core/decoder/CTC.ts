import Decoder from "../Decoder";
import { clean_up_tokenization } from "@utils/core";
import { TokenizerConfigDecoderCTC } from "@static/tokenizer";

/**
 * The CTC (Connectionist Temporal Classification) decoder.
 * See https://github.com/huggingface/tokenizers/blob/bb38f390a61883fc2f29d659af696f428d1cda6b/tokenizers/src/decoders/ctc.rs
 */
class CTC extends Decoder {
  pad_token: string;
  word_delimiter_token: string;
  cleanup?: boolean;

  constructor(config: TokenizerConfigDecoderCTC) {
    super(config);

    this.pad_token = config.pad_token ?? "";
    this.word_delimiter_token = config.word_delimiter_token ?? "";
    this.cleanup = config.cleanup;
  }

  /**
   * Converts a connectionist-temporal-classification (CTC) output tokens into a single string.
   * @param tokens Array of tokens to be decoded.
   * @returns The decoded string.
   */
  convert_tokens_to_string(tokens: string[]): string {
    if (tokens.length === 0) return "";

    // group same tokens into non-repeating tokens in CTC style decoding
    const grouped_tokens = [tokens[0]];
    for (let i = 1; i < tokens.length; ++i) {
      if (tokens[i] !== grouped_tokens.at(-1)) {
        grouped_tokens.push(tokens[i]);
      }
    }

    // filter self.pad_token which is used as CTC-blank token
    const filtered_tokens = grouped_tokens.filter(
      (token) => token !== this.pad_token,
    );

    let text = filtered_tokens.join("");
    if (this.cleanup) {
      // cleanup and replace delimiter token
      text = clean_up_tokenization(text)
        .replaceAll(this.word_delimiter_token, " ")
        .trim();
    }
    return text;
  }

  decode_chain(tokens: string[]): string[] {
    return [this.convert_tokens_to_string(tokens)];
  }
}

export default CTC;
