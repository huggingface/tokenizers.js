import PreTokenizer from "@core/PreTokenizer";

// Unicode-aware equivalent of the Rust regex `\w+|[^\w\s]+`. In Rust, `\w` covers the
// Alphabetic, Mark (M), Decimal_Number (Nd), Connector_Punctuation (Pc) and Join_Control
// properties, and `\s` is the White_Space property. JavaScript's `\w` is ASCII-only and its
// `\s` additionally matches U+FEFF, so neither can be used here.
const PATTERN =
  /[\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\p{Join_Control}]+|[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\p{Join_Control}\p{White_Space}]+/gu;

/**
 * Splits on word boundaries (using the following regular expression: `\w+|[^\w\s]+`).
 */
class Whitespace extends PreTokenizer {
  /**
   * Pre-tokenizes the input text by splitting it on word boundaries.
   * @param text The text to be pre-tokenized.
   * @param options Additional options for the pre-tokenization logic.
   * @returns An array of tokens produced by splitting the input text on whitespace.
   */
  pre_tokenize_text(text: string, options?: any): string[] {
    return text.match(PATTERN) || [];
  }
}

export default Whitespace;
