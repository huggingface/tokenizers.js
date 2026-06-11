import { Callable } from "@utils";

import type { PreTokenizeTextOptions } from "@static/tokenizer";

/**
 * A callable class representing a pre-tokenizer used in tokenization. Subclasses
 * should implement the `pre_tokenize_text` method to define the specific pre-tokenization logic.
 */
abstract class PreTokenizer extends Callable<
  [string | string[], any?],
  Array<[string, [number, number]]>
> {
  /**
   * Method that should be implemented by subclasses to define the specific pre-tokenization logic.
   *
   * @param text The text to pre-tokenize.
   * @param options Additional options for the pre-tokenization logic.
   * @returns The pre-tokenized text.
   */
  abstract pre_tokenize_text(
    text: string,
    options?: PreTokenizeTextOptions,
  ): Array<[string, [number,number]]>;

  /**
   * Tokenizes the given text into pre-tokens.
   * @param text The text or array of texts to pre-tokenize.
   * @param options Additional options for the pre-tokenization logic.
   * @returns An array of pre-tokens.
   */
  pre_tokenize(
    text: string | string[],
    options?: PreTokenizeTextOptions,
  ): Array<[string, [number,number]]> {
    return (
      Array.isArray(text)
        ? text.map((x) => this.pre_tokenize_text(x, options))
        : [this.pre_tokenize_text(text, options)]
    ).flat();
  }

  /**
   * Alias for {@link PreTokenizer#pre_tokenize}.
   * @param text The text or array of texts to pre-tokenize.
   * @param options Additional options for the pre-tokenization logic.
   * @returns An array of pre-tokens.
   */
  _call(text: string | string[], options?: any): Array<[string, [number,number]]> {
    return this.pre_tokenize(text, options);
  }
}

export default PreTokenizer;
