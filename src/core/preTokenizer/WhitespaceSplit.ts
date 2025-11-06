import PreTokenizer from "@core/PreTokenizer";
import { whitespace_split } from "@utils/core";

/**
 * Splits a string of text by whitespace characters into individual tokens.
 */
class WhitespaceSplit extends PreTokenizer {
  /**
   * Pre-tokenizes the input text by splitting it on whitespace characters.
   * @param text The text to be pre-tokenized.
   * @returns An array of tokens produced by splitting the input text on whitespace.
   */
  pre_tokenize_text(text: string): string[] {
    return whitespace_split(text);
  }
}

export default WhitespaceSplit;
