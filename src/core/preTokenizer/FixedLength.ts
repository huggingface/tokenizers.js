import PreTokenizer from "@core/PreTokenizer";
import type { TokenizerConfigPreTokenizerFixedLength } from "@static/tokenizer";

/**
 * Splits into fixed-length tokens.
 */
class FixedLength extends PreTokenizer {
  config: TokenizerConfigPreTokenizerFixedLength;
  private _length: number;

  /**
   * @param config The configuration options for the pre-tokenizer.
   */
  constructor(config: TokenizerConfigPreTokenizerFixedLength) {
    super();
    this.config = config;
    this._length = config.length;
  }

  /**
   * Pre-tokenizes the input text by splitting it into fixed-length tokens.
   * @param text The text to be pre-tokenized.
   * @returns An array of tokens produced by splitting the input text into fixed-length tokens.
   */
  pre_tokenize_text(text: string): string[] {
    const tokens = [];
    for (let i = 0; i < text.length; i += this._length) {
      tokens.push(text.slice(i, i + this._length));
    }
    return tokens;
  }
}

export default FixedLength;
