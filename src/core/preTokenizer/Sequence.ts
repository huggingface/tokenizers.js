import PreTokenizer from "@core/PreTokenizer";
import create_pre_tokenizer from "./create_pre_tokenizer";

import type { TokenizerConfigPreTokenizerSequence } from "@static/tokenizer";

/**
 * A pre-tokenizer that applies a sequence of pre-tokenizers to the input text.
 */
class Sequence extends PreTokenizer {
  tokenizers: (PreTokenizer | null)[];

  /**
   * Creates an instance of PreTokenizerSequence.
   * @param config The configuration object for the pre-tokenizer sequence.
   */
  constructor(config: TokenizerConfigPreTokenizerSequence) {
    super();
    this.tokenizers = (config.pretokenizers ?? []).map((x) =>
      create_pre_tokenizer(x),
    );
  }

  /**
   * Applies each pre-tokenizer in the sequence to the input text in turn.
   * @param text The text to pre-tokenize.
   * @param options Additional options for the pre-tokenization logic.
   * @returns The pre-tokenized text.
   */
  pre_tokenize_text(text: string, options?: any): Array<[string, [number, number]]> {
    return this.tokenizers.reduce(
      (pairs, tokenizer) => {
        if (!tokenizer) return pairs;
        return pairs.flatMap(([word, [start]]) =>
          tokenizer.pre_tokenize(word, options).map(([subWord, [subStart, subEnd]]) => [
            subWord,
            [subStart + start, subEnd + start] as [number, number],
          ]),
        );
      },
      [[text, [0, text.length]]] as Array<[string, [number, number]]>,
    );
  }
}

export default Sequence;
