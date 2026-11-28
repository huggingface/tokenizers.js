import Normalizer from "../Normalizer";

import type { TokenizerConfigNormalizerStrip } from "@static/tokenizer";

// Rust's `char::is_whitespace` (the Unicode White_Space property), which `tokenizers` uses.
// `String.prototype.trim()` uses a different set: it keeps U+0085 and strips U+FEFF.
// Every White_Space character is in the BMP, so checking one UTF-16 code unit at a time is enough.
const WHITE_SPACE = /\p{White_Space}/u;

/**
 * A normalizer that strips leading and/or trailing whitespace from the input text.
 */
class Strip extends Normalizer {
  declare config: TokenizerConfigNormalizerStrip;
  /**
   * Strip leading and/or trailing whitespace from the input text.
   * @param text The input text.
   * @returns The normalized text.
   */
  normalize(text: string): string {
    let start = 0;
    let end = text.length;
    if (this.config.strip_left) {
      while (start < end && WHITE_SPACE.test(text[start])) ++start;
    }
    if (this.config.strip_right) {
      while (end > start && WHITE_SPACE.test(text[end - 1])) --end;
    }
    return start === 0 && end === text.length ? text : text.slice(start, end);
  }
}

export default Strip;
