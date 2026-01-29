import { ReplacePattern } from "@static/tokenizer";
import { PROBLEMATIC_REGEX_MAP } from "@static/constants";

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
    let regex = pattern.Regex.replace(/\\([#&~])/g, "$1"); // TODO: add more characters to this list if necessary

    // We also handle special cases where the regex contains invalid (non-JS compatible) syntax.
    for (const [key, value] of PROBLEMATIC_REGEX_MAP) {
      regex = regex.replaceAll(key, value);
    }

    try {
      return new RegExp(regex, "gu");
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
      return new RegExp(fixed, "gu");
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
