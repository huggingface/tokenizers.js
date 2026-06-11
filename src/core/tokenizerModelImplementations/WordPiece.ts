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
  encode(tokens: Array<[string, [number, number]]>): Array<[string, [number, number]]> {
    const output_tokens: Array<[string, [number, number]]> = [];
    for (const [token, [word_start, word_end]] of tokens) {
      const chars = [...token];
      if (chars.length > this.max_input_chars_per_word) {
        output_tokens.push([this.unk_token!, [word_start, word_end]]);
        continue;
      }

      let is_unknown = false;
      let start = 0;
      const sub_tokens: Array<[string, [number, number]]> = [];

      while (start < chars.length) {
        let end = chars.length;
        let current_substring: string | null = null;
        const sub_start = start;
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
        sub_tokens.push([current_substring, [word_start + sub_start, word_start + end]]);
        start = end;
      }
      if (is_unknown) {
        output_tokens.push([this.unk_token!, [word_start, word_end]]);
      } else {
        output_tokens.push(...sub_tokens);
      }
    }

    return output_tokens;
  }
}

export default WordPieceTokenizer;
