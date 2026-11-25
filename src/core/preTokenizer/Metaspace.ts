import PreTokenizer from "@core/PreTokenizer";

import type {
  TokenizerConfigPreTokenizerMetaspace,
  PrependScheme,
  PreTokenizeTextOptions,
} from "@static/tokenizer";

/**
 * This PreTokenizer replaces spaces with the given replacement character, adds a prefix space if requested,
 * and returns a list of tokens.
 */
class Metaspace extends PreTokenizer {
  /** The character to replace spaces with. */
  replacement: string;
  /** An optional string representation of the replacement character. */
  str_rep: string;
  /** The metaspace prepending scheme. */
  prepend_scheme: PrependScheme;
  /** Whether to split the text into words before each replacement character. */
  split: boolean;

  /**
   * @param config The configuration object for the MetaspacePreTokenizer.
   */
  constructor(config: TokenizerConfigPreTokenizerMetaspace) {
    super();

    this.replacement = config.replacement ?? "▁";
    this.str_rep = config.str_rep || this.replacement;
    this.prepend_scheme = config.prepend_scheme ?? "always";
    // Like the Rust tokenizers library, configs without `split` (older ones) split.
    this.split = config.split ?? true;
  }

  /**
   * This method takes a string, replaces spaces with the replacement character,
   * adds a prefix space if requested, and returns a new list of tokens.
   * @param text The text to pre-tokenize.
   * @param options The options for the pre-tokenization.
   * @returns A new list of pre-tokenized tokens.
   */
  pre_tokenize_text(text: string, options?: PreTokenizeTextOptions): string[] {
    const { section_index = undefined } = options ?? {};
    let normalized = text.replaceAll(" ", this.str_rep);

    if (
      // We add a prefix space if:
      //  (1) The normalized token does not already start with the replacement character.
      !normalized.startsWith(this.replacement) &&
      // and (2) either:
      //  (a) prepend_scheme is 'always'
      //  (b) prepend_scheme is 'first' and this is the first section
      (this.prepend_scheme === "always" ||
        (this.prepend_scheme === "first" && section_index === 0))
    ) {
      normalized = this.str_rep + normalized;
    }
    if (!this.split) {
      return [normalized];
    }

    // Split before each replacement character, which starts the next word (like `MergedWithNext`).
    const words: string[] = [];
    let start = 0;
    for (
      let i = normalized.indexOf(this.replacement, 1);
      i !== -1;
      i = normalized.indexOf(this.replacement, i + this.replacement.length)
    ) {
      words.push(normalized.slice(start, i));
      start = i;
    }
    words.push(normalized.slice(start));
    return words;
  }
}

export default Metaspace;
