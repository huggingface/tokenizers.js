import { is_chinese_char } from "@utils/core";
import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerBert } from "@static/tokenizer";

/**
 * A class representing a normalizer used in BERT tokenization.
 */
class BertNormalizer extends Normalizer {
  declare config: TokenizerConfigNormalizerBert;

  /**
   * Adds whitespace around any CJK (Chinese, Japanese, or Korean) character in the input text.
   *
   * @param text The input text to tokenize.
   * @returns The tokenized text with whitespace added around CJK characters.
   */
  private tokenize_chinese_chars(text: string): string {
    const output: string[] = [];
    for (let i = 0; i < text.length; ++i) {
      const char = text[i];
      const cp = char.charCodeAt(0);
      if (is_chinese_char(cp)) {
        output.push(" ");
        output.push(char);
        output.push(" ");
      } else {
        output.push(char);
      }
    }
    return output.join("");
  }

  /**
   * Strips accents from the given text.
   * @param text The text to strip accents from.
   * @returns The text with accents removed.
   */
  strip_accents(text: string): string {
    // "Mark, Nonspacing" (Mn)
    return text.normalize("NFD").replace(/\p{Mn}/gu, "");
  }

  /**
   * Checks whether `char` is a control character.
   * @param char The character to check.
   * @returns Whether `char` is a control character.
   */
  private is_control(char: string): boolean {
    switch (char) {
      case "\t":
      case "\n":
      case "\r":
        // These are technically control characters but we count them as whitespace characters.
        return false;

      default:
        // Check if unicode category starts with C:
        // Cc - Control
        // Cf - Format
        // Co - Private Use
        // Cs - Surrogate
        return /^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u.test(char);
    }
  }

  /**
   * Performs invalid character removal and whitespace cleanup on text.
   * @param text The text to clean.
   * @returns The cleaned text.
   */
  private clean_text(text: string): string {
    const output: string[] = [];
    for (const char of text) {
      const cp = char.charCodeAt(0);
      if (cp === 0 || cp === 0xfffd || this.is_control(char)) {
        continue;
      }
      if (/^\s$/.test(char)) {
        // is whitespace
        output.push(" ");
      } else {
        output.push(char);
      }
    }
    return output.join("");
  }

  /**
   * Normalizes the given text based on the configuration.
   * @param text The text to normalize.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    if (this.config.clean_text) {
      text = this.clean_text(text);
    }

    if (this.config.handle_chinese_chars) {
      text = this.tokenize_chinese_chars(text);
    }

    if (this.config.lowercase) {
      text = text.toLowerCase();

      if (this.config.strip_accents !== false) {
        text = this.strip_accents(text);
      }
    } else if (this.config.strip_accents) {
      text = this.strip_accents(text);
    }

    return text;
  }
}

export default BertNormalizer;
