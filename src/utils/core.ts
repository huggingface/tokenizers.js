import { ReplacePattern } from "@static/tokenizer";

/**
 * Clean up a list of simple English tokenization artifacts like spaces before punctuations and abbreviated forms.
 * @param text The text to clean up.
 * @returns The cleaned up text.
 */
export const clean_up_tokenization = (text: string): string =>
  text
    .replace(/ \./g, ".")
    .replace(/ \?/g, "?")
    .replace(/ \!/g, "!")
    .replace(/ ,/g, ",")
    .replace(/ \' /g, "'")
    .replace(/ n't/g, "n't")
    .replace(/ 'm/g, "'m")
    .replace(/ 's/g, "'s")
    .replace(/ 've/g, "'ve")
    .replace(/ 're/g, "'re");

/**
 * Helper method to construct a pattern from a config object.
 * @param pattern The pattern object.
 * @param invert Whether to invert the pattern.
 * @returns The compiled pattern.
 */

export const create_pattern = (
  pattern: ReplacePattern,
  invert: boolean = true,
): RegExp | null => {
  if (pattern.Regex !== undefined) {
    // In certain cases, the pattern may contain unnecessary escape sequences (e.g., \# or \& or \~).
    // i.e., valid in Python (where the patterns are exported from) but invalid in JavaScript (where the patterns are parsed).
    // This isn't an issue when creating the regex w/o the 'u' flag, but it is when the 'u' flag is used.
    // For this reason, it is necessary to remove these backslashes before creating the regex.
    // See https://stackoverflow.com/a/63007777/13989043 for more information
    let regex = pattern.Regex.replace(
      /(\\+)([#&~"'`%])/g,
      (match, slashes, char) =>
        slashes.length % 2 === 0 ? match : `${slashes.slice(1)}${char}`,
    ); // TODO: add more characters to this list if necessary

    // Certain special sequences in the regex patterns are not supported in JavaScript, and need to be replaced with compatible alternatives.
    // For example, \A, \Z, and \z are not supported in JavaScript:
    // - \A matches the start of a string only. Unlike ^, this is not affected by multiline mode.
    // - \z matches the end of a string only. Unlike $, this is not affected by multiline mode.
    // - \Z matches the end of a string, or before a final newline. This is not affected by multiline mode.
    //
    // Since JavaScript does not support \A, \Z, or \z, we replace them with absolute lookarounds.
    // This lets us keep Python/Rust-style multiline ^ behavior without changing absolute anchors.
    // For \Z, we replace it with a lookahead for the end of the string, allowing for an optional final newline.
    regex = regex
      .replace(/\\A/g, "(?<![\\s\\S])")
      .replace(/\\z/g, "(?![\\s\\S])")
      .replace(/\\Z/g, "(?=\\r?\\n?(?![\\s\\S]))")
      .replace(/\\\n/g, "\\n")
      .replace(/\\\t/g, "\\t");

    // JavaScript treats shorthands like \w and \d as ASCII-only, while Python/Rust tokenizers use Unicode-aware semantics.
    // Normalize these shorthands so multilingual tokenizers keep expected behavior in JS.
    regex = normalize_unicode_shorthands(regex);

    regex = normalize_inline_case_insensitive_groups(regex);
    regex = normalize_non_js_regex_syntax(regex);
    regex = normalize_dot_wildcards(regex);

    try {
      return new RegExp(regex, "gmu");
    } catch (error) {
      // For JavaScript regular expressions, when you want to match a specific script using \p{...}, you must explicitly specify the property name Script (or sc).
      // For example, to match Hangul characters, you need to use \p{Script=Hangul} or \p{sc=Hangul}, instead of just \p{Hangul} (which is valid in Python).
      // General_Category properties, on the other hand, can be used without specifying the property name (see https://unicode.org/reports/tr18/#General_Category_Property).
      // If we encounter a property name error, we attempt to fix it by adding 'Script=' where necessary.
      if (
        !(error instanceof SyntaxError) ||
        !error.message.toLowerCase().includes("invalid property name")
      )
        throw error;

      let changed = false;
      const fixed = regex.replace(/(\\[pP])\{([^}=]+)\}/g, (_, p, n) => {
        try {
          new RegExp(`\\p{${n}}`, "u");
          return `${p}{${n}}`;
        } catch {
          changed = true;
          return `${p}{Script=${n}}`;
        }
      });

      if (!changed) throw error;
      try {
        return new RegExp(fixed, "gmu");
      } catch (e) {
        // If it still fails, re-throw the original error for clarity.
        throw error;
      }
    }
  } else if (pattern.String !== undefined) {
    const escaped = escape_reg_exp(pattern.String);
    // NOTE: if invert is true, we wrap the pattern in a group so that it is kept when performing .split()
    return new RegExp(invert ? escaped : `(${escaped})`, "gu");
  } else {
    console.warn("Unknown pattern type:", pattern);
    return null;
  }
};

// Normalizes tokenizer regex constructs that Python/Rust accept but JavaScript RegExp does not.
// This replaces the old PROBLEMATIC_REGEX_MAP with structural rewrites so equivalent patterns are covered too.
const normalize_non_js_regex_syntax = (regex: string): string =>
  strip_possessive_quantifiers(
    escape_literal_closing_brackets(
      normalize_bloom_split_char_class(
        regex
          // JS doesn't support \h; approximate it with horizontal whitespace.
          .replace(/\\h/g, "[^\\S\\r\\n]")
          // \G is an invalid escape in JS. Hub patterns mostly use it for contiguous digit chunks; approximate that case and remove the rest.
          .replace(/\\G(?=\\p\{Nd\})/g, "(?<=\\p{Nd})")
          .replace(/\\G/g, "")
          // JS doesn't support atomic groups. These are used in AFMoE tokenizers, so keep the group without atomic backtracking behavior.
          .replace(/\(\?>/g, "(?:")
          // JS doesn't support stacking quantifiers, e.g. \p{Nd}{3}+. Repeat the fixed-width chunk instead.
          .replace(/((?:\\[pP]\{[^}]+\})\{\d+\})\+/g, "(?:$1)+"),
      ),
    ),
  );

// Used to override the default invalid regex of the Bloom pretokenizer:
// ` ?[^(\\s|[.,!?…。，、।۔،])]+`.
// For more information, see https://github.com/huggingface/transformers.js/issues/94
const normalize_bloom_split_char_class = (regex: string): string =>
  regex.replace(/\[\^\(\\s\|\[([^\]]+)\]\)\]/g, "[^()|\\s$1]");

const normalize_dot_wildcards = (regex: string): string => {
  let normalized = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ++i) {
    const char = regex[i];

    if (char === "\\" && i + 1 < regex.length) {
      normalized += `${char}${regex[++i]}`;
      continue;
    }

    if (char === "[" && !in_char_class) {
      in_char_class = true;
      normalized += char;
      continue;
    }

    if (char === "]" && in_char_class) {
      in_char_class = false;
      normalized += char;
      continue;
    }

    normalized += char === "." && !in_char_class ? "[^\\n]" : char;
  }

  return normalized;
};

// JS doesn't support possessive quantifiers. These are used in recent OpenAI tokenizers.
// Strip only true quantifier suffixes so escaped literal `+` patterns keep their meaning.
const strip_possessive_quantifiers = (regex: string): string => {
  let normalized = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ++i) {
    const char = regex[i];

    if (char === "\\" && i + 1 < regex.length) {
      normalized += `${char}${regex[++i]}`;
      continue;
    }

    if (char === "[" && !in_char_class) {
      in_char_class = true;
      normalized += char;
      continue;
    }

    if (char === "]" && in_char_class) {
      in_char_class = false;
      normalized += char;
      continue;
    }

    if (!in_char_class && regex[i + 1] === "+") {
      if (char === "?" || char === "+" || char === "*") {
        normalized += char;
        ++i;
        continue;
      }

      if (char === "}" && is_repetition_quantifier_end(regex, i)) {
        normalized += char;
        ++i;
        continue;
      }
    }

    normalized += char;
  }

  return normalized;
};

const is_repetition_quantifier_end = (
  regex: string,
  close_brace_index: number,
): boolean => {
  let open_brace_index = close_brace_index - 1;
  while (open_brace_index >= 0 && regex[open_brace_index] !== "{") {
    --open_brace_index;
  }

  if (
    open_brace_index < 0 ||
    is_escaped(regex, open_brace_index) ||
    is_escaped(regex, close_brace_index)
  ) {
    return false;
  }

  return /^\d+(?:,\d*)?$/.test(
    regex.slice(open_brace_index + 1, close_brace_index),
  );
};

const is_escaped = (regex: string, index: number): boolean => {
  let slash_count = 0;
  for (let i = index - 1; i >= 0 && regex[i] === "\\"; --i) {
    ++slash_count;
  }
  return slash_count % 2 === 1;
};

const escape_literal_closing_brackets = (regex: string): string => {
  let normalized = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ++i) {
    const char = regex[i];

    if (char === "\\" && i + 1 < regex.length) {
      normalized += `${char}${regex[++i]}`;
      continue;
    }

    if (char === "[" && !in_char_class) {
      in_char_class = true;
      normalized += char;
      continue;
    }

    if (char === "]" && in_char_class) {
      in_char_class = false;
      normalized += char;
      continue;
    }

    normalized += char === "]" ? "\\]" : char;
  }

  return normalized;
};

// Python/Rust tokenizer regexes use inline case-insensitive groups like `(?i:...)`.
// JavaScript does not support this group modifier and throws "Invalid group", so expand ASCII letters locally.
const normalize_inline_case_insensitive_groups = (regex: string): string => {
  let normalized = "";

  for (let i = 0; i < regex.length; ++i) {
    if (!regex.startsWith("(?i:", i)) {
      normalized += regex[i];
      continue;
    }

    const start = i + 4;
    let depth = 1;
    let in_char_class = false;
    let end = start;

    for (; end < regex.length; ++end) {
      const char = regex[end];

      if (char === "\\") {
        ++end;
        continue;
      }

      if (char === "[" && !in_char_class) {
        in_char_class = true;
        continue;
      }

      if (char === "]" && in_char_class) {
        in_char_class = false;
        continue;
      }

      if (in_char_class) continue;

      if (char === "(") {
        ++depth;
      } else if (char === ")" && --depth === 0) {
        break;
      }
    }

    if (depth !== 0) {
      normalized += regex.slice(i);
      break;
    }

    normalized += `(?:${make_ascii_case_insensitive(regex.slice(start, end))})`;
    i = end;
  }

  return normalized;
};

const make_ascii_case_insensitive = (regex: string): string => {
  let normalized = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ++i) {
    const char = regex[i];

    if (char === "\\" && i + 1 < regex.length) {
      normalized += `${char}${regex[++i]}`;
      continue;
    }

    if (char === "[" && !in_char_class) {
      in_char_class = true;
      normalized += char;
      continue;
    }

    if (char === "]" && in_char_class) {
      in_char_class = false;
      normalized += char;
      continue;
    }

    if (is_ascii_letter(char)) {
      if (in_char_class) {
        const prev = regex[i - 1];
        const next = regex[i + 1];
        normalized +=
          prev === "-" || next === "-"
            ? char
            : `${char.toLowerCase()}${char.toUpperCase()}`;
      } else {
        normalized += `[${char.toLowerCase()}${char.toUpperCase()}]`;
      }
    } else {
      normalized += char;
    }
  }

  return normalized;
};

const is_ascii_letter = (char: string): boolean => /[A-Za-z]/.test(char);

const UNICODE_WORD_CHARS = "\\p{L}\\p{M}\\p{N}_";
const UNICODE_WORD_BOUNDARY = `(?:(?<![${UNICODE_WORD_CHARS}])(?=[${UNICODE_WORD_CHARS}])|(?<=[${UNICODE_WORD_CHARS}])(?![${UNICODE_WORD_CHARS}]))`;
const UNICODE_NON_WORD_BOUNDARY = `(?:(?<![${UNICODE_WORD_CHARS}])(?![${UNICODE_WORD_CHARS}])|(?<=[${UNICODE_WORD_CHARS}])(?=[${UNICODE_WORD_CHARS}]))`;

// Python/Rust tokenizer shorthands are Unicode-aware. JavaScript's \w, \d, and word boundaries are not.
const normalize_unicode_shorthands = (regex: string): string => {
  let normalized = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ++i) {
    const char = regex[i];

    if (char === "\\" && i + 1 < regex.length) {
      const next = regex[i + 1];

      if (next === "\\") {
        normalized += "\\\\";
        ++i;
        continue;
      }

      if (next === "w") {
        normalized += in_char_class
          ? "\\p{L}\\p{M}\\p{N}_"
          : "[\\p{L}\\p{M}\\p{N}_]";
        ++i;
        continue;
      }

      if (next === "W") {
        if (in_char_class) {
          // Tokenizer regex contains \\W inside a character class, which is not Unicode-normalized yet.
          normalized += "\\W";
        } else {
          normalized += "[^\\p{L}\\p{M}\\p{N}_]";
        }
        ++i;
        continue;
      }

      if (next === "d") {
        normalized += "\\p{Nd}";
        ++i;
        continue;
      }

      if (next === "D") {
        normalized += "\\P{Nd}";
        ++i;
        continue;
      }

      if (next === "b" && !in_char_class) {
        normalized += UNICODE_WORD_BOUNDARY;
        ++i;
        continue;
      }

      if (next === "B" && !in_char_class) {
        normalized += UNICODE_NON_WORD_BOUNDARY;
        ++i;
        continue;
      }

      normalized += `\\${next}`;
      ++i;
      continue;
    }

    if (char === "[" && !in_char_class) {
      in_char_class = true;
    } else if (char === "]" && in_char_class) {
      in_char_class = false;
    }

    normalized += char;
  }

  return normalized;
};

export const escape_reg_exp = (string: string): string =>
  string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string

/**
 * Helper function to fuse consecutive unknown tokens.
 */
export const fuse_unk = (
  arr: Array<string>,
  tokens_to_ids: Map<string, any>,
  unk_token_id: number,
) => {
  const fused = [];
  let i = 0;
  while (i < arr.length) {
    fused.push(arr[i]);
    const token_id = tokens_to_ids.get(arr[i]) ?? unk_token_id;
    if (token_id !== unk_token_id) {
      ++i;
      continue;
    }
    while (
      ++i < arr.length &&
      (tokens_to_ids.get(arr[i]) ?? unk_token_id) === unk_token_id
    ) {
      if (tokens_to_ids.get(fused.at(-1)) !== unk_token_id) {
        fused[fused.length - 1] += arr[i];
      }
    }
  }
  return fused;
};

export const is_chinese_char = (cp: number): boolean =>
  (cp >= 0x4e00 && cp <= 0x9fff) ||
  (cp >= 0x3400 && cp <= 0x4dbf) ||
  (cp >= 0x20000 && cp <= 0x2a6df) ||
  (cp >= 0x2a700 && cp <= 0x2b73f) ||
  (cp >= 0x2b740 && cp <= 0x2b81f) ||
  (cp >= 0x2b820 && cp <= 0x2ceaf) ||
  (cp >= 0xf900 && cp <= 0xfaff) ||
  (cp >= 0x2f800 && cp <= 0x2fa1f);

/**
 * Check if a value is an integer.
 * @param {*} x The value to check.
 * @returns {boolean} True if the value is a string, false otherwise.
 */

export const is_integral_number = (x: number | bigint): boolean =>
  Number.isInteger(x) || typeof x === "bigint";

/**
 * Calculate the length of a string, taking multi-byte characters into account.
 * This mimics the behavior of Python's `len` function.
 */
export const len = (s: string): number => {
  let length = 0;
  for (const c of s) ++length;
  return length;
};

export const lowercase_and_remove_accents = (text: string): string =>
  remove_accents(text.toLowerCase());

/**
 * Efficiently merge arrays, creating a new copy.
 * Adapted from https://stackoverflow.com/a/6768642/13989043
 */
export const merge_arrays = (...arrs: Array<Array<any>>): any[] =>
  Array.prototype.concat.apply([], arrs);

export const object_to_map = (obj: Object): Map<string, any> =>
  new Map(Object.entries(obj));

/**
 * Helper function to split a string on a regex, but keep the delimiters.
 * This is required, because the JavaScript `.split()` method does not keep the delimiters,
 * and wrapping in a capturing group causes issues with existing capturing groups (due to nesting).
 * @param text The text to split.
 * @param regex The regex to split on.
 * @returns The split string.
 */
export const regex_split = (text: string, regex: RegExp): string[] => {
  const result: string[] = [];
  let prev = 0;
  for (const match of text.matchAll(regex)) {
    const full_match = match[0];
    if (prev < match.index!) {
      result.push(text.slice(prev, match.index));
    }
    if (full_match.length > 0) {
      result.push(full_match);
    }
    prev = match.index! + full_match.length;
  }
  if (prev < text.length) {
    result.push(text.slice(prev));
  }
  return result;
};

export const remove_accents = (text: string): string =>
  text.replace(/\p{M}/gu, "");

export const validate_object = (
  obj: Object,
  name: string,
  required_keys: string[] = [],
): string => {
  if (!obj || Array.isArray(obj) || typeof obj !== "object") {
    return `${name} must be a valid object`;
  }

  for (const key of required_keys) {
    if (!(key in obj)) {
      return `${name} must contain a "${key}" property`;
    }
  }

  return null;
};

/**
 * Split a string on whitespace.
 * @param {string} text The text to split.
 * @returns {string[]} The split string.
 */
export const whitespace_split = (text: string): Array<string> =>
  text.match(/\S+/g) || [];
