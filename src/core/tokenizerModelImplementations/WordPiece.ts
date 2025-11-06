import TokenizerModel from "../TokenizerModel";
import { object_to_map } from "@utils/core";
import { TokenizerConfigWordPieceModel } from "@static/tokenizer";

/**
 * A subclass of TokenizerModel that uses WordPiece encoding to encode tokens.
 */
class WordPieceTokenizer extends TokenizerModel {
  declare config: TokenizerConfigWordPieceModel;
  /** The maximum number of characters per word. */
  max_input_chars_per_word: number = 100;

  /**
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigWordPieceModel) {
    super(config);

    this.tokens_to_ids = object_to_map(config.vocab);
    this.unk_token_id = this.tokens_to_ids.get(config.unk_token);
    this.unk_token = config.unk_token;
    this.max_input_chars_per_word = config.max_input_chars_per_word ?? 100;

    this.vocab = new Array(this.tokens_to_ids.size);
    for (const [key, value] of this.tokens_to_ids) {
      this.vocab[value] = key;
    }
  }

  /**
   * Encodes an array of tokens using WordPiece encoding.
   * @param tokens The tokens to encode.
   * @returns An array of encoded tokens.
   */
  encode(tokens: string[]): string[] {
    const output_tokens: string[] = [];
    for (const token of tokens) {
      const chars = [...token];
      if (chars.length > this.max_input_chars_per_word) {
        output_tokens.push(this.unk_token!);
        continue;
      }

      let is_unknown = false;
      let start = 0;
      const sub_tokens: string[] = [];

      while (start < chars.length) {
        let end = chars.length;
        let current_substring: string | null = null;
        while (start < end) {
          let substr = chars.slice(start, end).join("");

          if (start > 0) {
            substr = this.config.continuing_subword_prefix + substr;
          }
          if (this.tokens_to_ids.has(substr)) {
            current_substring = substr;
            break;
          }

          --end;
        }
        if (current_substring === null) {
          is_unknown = true;
          break;
        }
        sub_tokens.push(current_substring);
        start = end;
      }
      if (is_unknown) {
        output_tokens.push(this.unk_token!);
      } else {
        output_tokens.push(...sub_tokens);
      }
    }

    return output_tokens;
  }
}

export default WordPieceTokenizer;
