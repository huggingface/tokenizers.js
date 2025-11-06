import PreTokenizer from "../PreTokenizer";
import { PUNCTUATION_REGEX } from "@static/constants";

/**
 * A PreTokenizer that splits text into wordpieces using a basic tokenization scheme
 * similar to that used in the original implementation of BERT.
 */
class BertPreTokenizer extends PreTokenizer {
  pattern: RegExp;

  /**
   * A PreTokenizer that splits text into wordpieces using a basic tokenization scheme
   * similar to that used in the original implementation of BERT.
   */
  constructor() {
    super();
    // Construct a pattern which matches the rust implementation:
    // https://github.com/huggingface/tokenizers/blob/b4fcc9ce6e4ad5806e82826f816acfdfdc4fcc67/tokenizers/src/pre_tokenizers/bert.rs#L11
    // Equivalent to removing whitespace and splitting on punctuation (both \p{P} and other ascii characters)
    this.pattern = new RegExp(
      `[^\\s${PUNCTUATION_REGEX}]+|[${PUNCTUATION_REGEX}]`,
      "gu",
    );
  }

  /**
   * Tokenizes a single text using the BERT pre-tokenization scheme.
   *
   * @param text The text to tokenize.
   * @param options Additional options for the pre-tokenization logic.
   * @returns An array of tokens.
   */
  pre_tokenize_text(text: string, options?: any): string[] {
    return text.trim().match(this.pattern) || [];
  }
}

export default BertPreTokenizer;
