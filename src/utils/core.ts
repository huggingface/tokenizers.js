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
    // Tokenizer `Regex` patterns are authored for the Rust `tokenizers` crate (Oniguruma).
    // Translate their syntax and Unicode semantics into a JavaScript `RegExp` (with the 'u'
    // flag); rewrites are verified against Python `tokenizers` (see tests/py/).
    let regex = normalize_bloom_split_char_class(pattern.Regex);
    regex = normalize_inline_case_insensitive_groups(regex);
    regex = rewrite_oniguruma_to_js(regex);

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
      try {
        return new RegExp(fixed, "gu");
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

// Oniguruma's word characters are Alphabetic | Mark | Decimal_Number | Connector_Punctuation.
// Standalone shorthands (\w, \W, \b, \B, \p{Word}) additionally include the Latin-1
// superscripts and fractions from its ASCII-range ctype table; shorthands written inside a
// character class use only the pure Unicode properties.
const UNICODE_WORD_CHARS_IN_CLASS = "\\p{Alphabetic}\\p{M}\\p{Nd}\\p{Pc}";
const UNICODE_WORD_CHARS = `${UNICODE_WORD_CHARS_IN_CLASS}\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE`;
const UNICODE_WORD_CLASS = `[${UNICODE_WORD_CHARS}]`;
const UNICODE_NON_WORD_CLASS = `[^${UNICODE_WORD_CHARS}]`;
const UNICODE_WORD_BOUNDARY = `(?:(?<!${UNICODE_WORD_CLASS})(?=${UNICODE_WORD_CLASS})|(?<=${UNICODE_WORD_CLASS})(?!${UNICODE_WORD_CLASS}))`;
const UNICODE_NON_WORD_BOUNDARY = `(?:(?<!${UNICODE_WORD_CLASS})(?!${UNICODE_WORD_CLASS})|(?<=${UNICODE_WORD_CLASS})(?=${UNICODE_WORD_CLASS}))`;

// Oniguruma line anchors only recognize \n as a line break; JavaScript's 'm' flag would also
// anchor around \r, U+2028, and U+2029, so ^/$ are rewritten instead of using the flag.
const LINE_START_ANCHOR = "(?:(?<![\\s\\S])|(?<=\\n))";
const LINE_END_ANCHOR = "(?:(?=\\n)|(?![\\s\\S]))";

// Oniguruma \h is a hexadecimal digit (Ruby syntax), not horizontal whitespace.
const HEX_DIGIT_CHARS = "0-9A-Fa-f";

// Escape sequences rewritten outside character classes.
const ESCAPE_REWRITES = new Map<string, string>([
  ["A", "(?<![\\s\\S])"],
  ["z", "(?![\\s\\S])"],
  ["Z", "(?=\\n?(?![\\s\\S]))"], // \Z permits a single optional final \n (not \r\n)
  ["h", `[${HEX_DIGIT_CHARS}]`],
  ["H", `[^${HEX_DIGIT_CHARS}]`],
  ["w", UNICODE_WORD_CLASS],
  ["W", UNICODE_NON_WORD_CLASS],
  ["d", "\\p{Nd}"],
  ["D", "\\P{Nd}"],
  ["s", "\\p{White_Space}"], // JS \s wrongly adds U+FEFF and misses \x85
  ["S", "\\P{White_Space}"],
  ["b", UNICODE_WORD_BOUNDARY],
  ["B", UNICODE_NON_WORD_BOUNDARY],
  ["a", "\\x07"],
  ["e", "\\x1B"],
]);

// Escape sequences rewritten inside character classes. \b stays a backspace here. \W and \H
// are complements of unions, which JavaScript cannot express inside a class: in positive
// classes they are lifted out as alternation branches (see rewrite_oniguruma_to_js); in
// negated classes they are left as-is (\W silently falls back to ASCII semantics, \H fails
// loudly at compile time).
const CLASS_ESCAPE_REWRITES = new Map<string, string>([
  ["h", HEX_DIGIT_CHARS],
  ["w", UNICODE_WORD_CHARS_IN_CLASS],
  ["d", "\\p{Nd}"],
  ["D", "\\P{Nd}"],
  ["s", "\\p{White_Space}"],
  ["S", "\\P{White_Space}"],
  ["a", "\\x07"],
  ["e", "\\x1B"],
]);

// Complement classes for shorthands lifted out of positive character classes.
const CLASS_COMPLEMENT_ALTERNATIVES = new Map<string, string>([
  ["W", `[^${UNICODE_WORD_CHARS_IN_CLASS}]`],
  ["H", `[^${HEX_DIGIT_CHARS}]`],
]);

// Escapes of literal whitespace characters (e.g. a backslash followed by a real newline),
// which Oniguruma accepts but JavaScript's 'u' flag rejects.
const RAW_WHITESPACE_ESCAPES = new Map<string, string>([
  ["\n", "\\n"],
  ["\r", "\\r"],
  ["\t", "\\t"],
  ["\f", "\\f"],
  ["\v", "\\v"],
]);

// POSIX bracket expressions ([:name:]) -> JavaScript class fragments.
const POSIX_CLASS_FRAGMENTS: Record<string, string> = {
  alpha: "\\p{Alphabetic}",
  alnum: "\\p{Alphabetic}\\p{Nd}",
  digit: "\\p{Nd}",
  lower: "\\p{Lowercase}",
  upper: "\\p{Uppercase}",
  space: "\\p{White_Space}",
  blank: "\\t\\p{Zs}",
  punct: "\\p{P}",
  cntrl: "\\p{Cc}",
  word: UNICODE_WORD_CHARS_IN_CLASS,
  xdigit: HEX_DIGIT_CHARS,
};

// Punctuation that JavaScript's 'u' flag allows to be escaped. Any other escaped punctuation
// is an Oniguruma identity escape (e.g. \# or \"), whose backslash must be dropped.
const JS_SYNTAX_CHARS = "^$\\.*+?()[]{}|/";

// Group prefixes that must be copied verbatim (their letters are syntax, not literals).
const GROUP_PREFIX_RE = /^\(\?(?:<[=!]|<[A-Za-z_][A-Za-z0-9_]*>|[:=!>])/;

// Braced escape sequences, consumed as a single token: \p{..}, \P{..}, \x{..}, \u{..}.
const BRACED_ESCAPE_RE = /^\\([pPxu])\{([^}]*)\}/;

// Quantifier braces. Oniguruma also accepts {,m} as {0,m}; bare braces that don't form a
// quantifier are literal characters.
const QUANTIFIER_BRACE_RE = /^\{(\d+(?:,\d*)?|,\d+)\}/;

const is_ascii_letter = (char: string): boolean => /[A-Za-z]/.test(char);

// Returns the raw text of the regex token starting at `i`: a (possibly braced) escape
// sequence, or a single character.
const next_regex_token = (regex: string, i: number): string => {
  if (regex[i] !== "\\") return regex[i];
  const braced = BRACED_ESCAPE_RE.exec(regex.slice(i));
  if (braced) return braced[0];
  return i + 1 < regex.length ? regex.slice(i, i + 2) : regex[i];
};

// Returns the index of the ")" closing the group whose contents start at `start`, or -1.
const find_group_end = (regex: string, start: number): number => {
  let depth = 1;
  let in_char_class = false;
  for (
    let i = start;
    i < regex.length;
    i += next_regex_token(regex, i).length
  ) {
    const char = regex[i];
    if (char === "\\") continue;
    if (char === "[" && !in_char_class) in_char_class = true;
    else if (char === "]" && in_char_class) in_char_class = false;
    else if (!in_char_class && char === "(") ++depth;
    else if (!in_char_class && char === ")" && --depth === 0) return i;
  }
  return -1;
};

// Python/Rust tokenizer regexes use inline case-insensitive groups like `(?i:...)`.
// JavaScript does not support this group modifier and throws "Invalid group", so the
// contents are expanded locally. Note: only ASCII (simple) case folding is performed;
// full Unicode case folding (e.g. ß ~ ss, K ~ K) is a known limitation.
const normalize_inline_case_insensitive_groups = (regex: string): string => {
  let out = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ) {
    if (!in_char_class && regex.startsWith("(?i:", i)) {
      const end = find_group_end(regex, i + 4);
      if (end < 0) {
        // Unterminated group: leave the remainder untouched (it will fail loudly downstream).
        out += regex.slice(i);
        break;
      }
      const contents = normalize_inline_case_insensitive_groups(
        regex.slice(i + 4, end),
      );
      out += `(?:${fold_ascii_case(contents)})`;
      i = end + 1;
      continue;
    }

    const token = next_regex_token(regex, i);
    if (token === "[" && !in_char_class) in_char_class = true;
    else if (token === "]" && in_char_class) in_char_class = false;
    out += token;
    i += token.length;
  }

  return out;
};

// Expands ASCII letters in `regex` so the pattern matches both cases: `a` becomes `[aA]`,
// and class ranges like `[a-f]` become `[a-fA-F]`.
const fold_ascii_case = (regex: string): string => {
  let out = "";
  let in_char_class = false;

  for (let i = 0; i < regex.length; ) {
    const char = regex[i];

    if (char === "\\") {
      const token = next_regex_token(regex, i);
      out += token;
      i += token.length;
      continue;
    }

    if (!in_char_class && char === "(") {
      // Copy group syntax (e.g. `(?<name>`) verbatim so its letters aren't folded.
      const prefix = GROUP_PREFIX_RE.exec(regex.slice(i))?.[0] ?? "(";
      out += prefix;
      i += prefix.length;
      continue;
    }

    if (char === "[" && !in_char_class) {
      in_char_class = true;
      out += char;
      ++i;
      if (regex[i] === "^") {
        out += "^";
        ++i;
      }
      continue;
    }

    if (char === "]" && in_char_class) {
      in_char_class = false;
      out += char;
      ++i;
      continue;
    }

    if (!is_ascii_letter(char)) {
      out += char;
      ++i;
      continue;
    }

    if (!in_char_class) {
      out += `[${char.toLowerCase()}${char.toUpperCase()}]`;
      ++i;
      continue;
    }

    // Inside a character class, skip letters that are the *end* of a range (the range start
    // already emitted them).
    if (regex[i - 1] === "-" && regex[i - 2] !== "[") {
      out += char;
      ++i;
      continue;
    }

    // Fold a range like `a-f` by appending its opposite-case form. Case-transforming the whole
    // `x-y` string keeps the endpoints ordered (`"a-f".toUpperCase()` -> `"A-F"`).
    if (
      regex[i + 1] === "-" &&
      regex[i + 2] !== undefined &&
      regex[i + 2] !== "]"
    ) {
      const range = `${char}-${regex[i + 2]}`;
      const folded =
        range === range.toLowerCase()
          ? range.toUpperCase()
          : range.toLowerCase();
      out += `${range}${folded}`;
      i += 3;
      continue;
    }

    out += `${char.toLowerCase()}${char.toUpperCase()}`;
    ++i;
  }

  return out;
};

// Used to override the default invalid regex of the Bloom pretokenizer:
// ` ?[^(\\s|[.,!?…。，、।۔،])]+`.
// For more information, see https://github.com/huggingface/transformers.js/issues/94
const normalize_bloom_split_char_class = (regex: string): string =>
  regex.replace(/\[\^\(\\s\|\[([^\]]+)\]\)\]/g, "[^()|\\s$1]");

// The main Oniguruma -> JavaScript rewrite: a single pass that translates escapes,
// shorthands, anchors, quantifiers, and class syntax. `atom_start` tracks where the most
// recent complete atom begins in the output so stacked quantifiers can wrap it in a group.
const rewrite_oniguruma_to_js = (regex: string): string => {
  let out = "";
  let atom_start = -1; // index in `out` of the last complete atom, or -1
  let last_was_quantifier = false;
  const group_starts: number[] = [];

  // Character-class contents are buffered so that positive classes containing \W or \H
  // (complements JavaScript cannot express inside a class) can be emitted as alternations,
  // e.g. `[\W_]` becomes `(?:[_]|[^...word...])`.
  let in_char_class = false;
  let class_negated = false;
  let class_buffer = "";
  let class_alternatives: string[] = [];

  const emit_atom = (text: string) => {
    atom_start = out.length;
    out += text;
    last_was_quantifier = false;
  };

  for (let i = 0; i < regex.length; ) {
    const char = regex[i];

    if (char === "\\") {
      const braced = BRACED_ESCAPE_RE.exec(regex.slice(i));
      if (braced) {
        const [text, kind, body] = braced;
        let replacement = text;
        if (kind === "x") {
          // Oniguruma writes braced code points as \x{...}; JavaScript uses \u{...}.
          replacement = `\\u{${body}}`;
        } else if (body === "Word") {
          // Oniguruma's \p{Word} property is its word-character class.
          replacement =
            kind === "p"
              ? in_char_class
                ? UNICODE_WORD_CHARS_IN_CLASS
                : UNICODE_WORD_CLASS
              : in_char_class
                ? text
                : UNICODE_NON_WORD_CLASS;
        }
        if (in_char_class) class_buffer += replacement;
        else emit_atom(replacement);
        i += text.length;
        continue;
      }

      if (i + 1 >= regex.length) {
        // Trailing lone backslash: pass through (fails loudly at compile time).
        out += char;
        break;
      }

      const next = regex[i + 1];
      i += 2;

      if (!in_char_class && next === "G") {
        // \G (continuation anchor) has no JavaScript equivalent. Hub patterns use it as a
        // match-chaining optimization; dropping it is a documented approximation.
        continue;
      }

      const raw_whitespace = RAW_WHITESPACE_ESCAPES.get(next);
      if (raw_whitespace !== undefined) {
        // An escaped literal whitespace character (valid in Oniguruma, invalid with 'u').
        if (in_char_class) class_buffer += raw_whitespace;
        else emit_atom(raw_whitespace);
        continue;
      }

      const complement = CLASS_COMPLEMENT_ALTERNATIVES.get(next);
      if (in_char_class && !class_negated && complement !== undefined) {
        class_alternatives.push(complement);
        continue;
      }

      const rewrite = (
        in_char_class ? CLASS_ESCAPE_REWRITES : ESCAPE_REWRITES
      ).get(next);
      let replacement: string;
      if (rewrite !== undefined) {
        replacement = rewrite;
      } else if (/[A-Za-z0-9]/.test(next)) {
        // Real escape classes, backreferences, \xNN, \uNNNN, \cX, etc.
        replacement = `\\${next}`;
      } else if (
        JS_SYNTAX_CHARS.includes(next) ||
        (in_char_class && next === "-")
      ) {
        replacement = `\\${next}`;
      } else {
        // Oniguruma identity escape of punctuation (e.g. \# or \"): drop the backslash.
        replacement = next;
      }
      if (in_char_class) class_buffer += replacement;
      else emit_atom(replacement);
      continue;
    }

    if (in_char_class) {
      if (char === "]") {
        in_char_class = false;
        const pieces: string[] = [];
        if (class_buffer.length > 0 || class_alternatives.length === 0) {
          pieces.push(`[${class_negated ? "^" : ""}${class_buffer}]`);
        }
        pieces.push(...class_alternatives);
        emit_atom(pieces.length === 1 ? pieces[0] : `(?:${pieces.join("|")})`);
        ++i;
        continue;
      }
      if (char === "[") {
        const posix = /^\[:([a-z]+):\]/.exec(regex.slice(i));
        if (posix && POSIX_CLASS_FRAGMENTS[posix[1]] !== undefined) {
          class_buffer += POSIX_CLASS_FRAGMENTS[posix[1]];
          i += posix[0].length;
          continue;
        }
      }
      class_buffer += char;
      ++i;
      continue;
    }

    switch (char) {
      case "[": {
        in_char_class = true;
        class_buffer = "";
        class_alternatives = [];
        last_was_quantifier = false;
        ++i;
        class_negated = regex[i] === "^";
        if (class_negated) ++i;
        continue;
      }
      case "]":
        // A stray "]" is a literal in Oniguruma but a syntax error with the 'u' flag.
        emit_atom("\\]");
        ++i;
        continue;
      case ".":
        // Oniguruma's . excludes only \n; JavaScript's also excludes \r, U+2028, and U+2029.
        emit_atom("[^\\n]");
        ++i;
        continue;
      case "^":
        emit_atom(LINE_START_ANCHOR);
        ++i;
        continue;
      case "$":
        emit_atom(LINE_END_ANCHOR);
        ++i;
        continue;
      case "(": {
        const prefix = GROUP_PREFIX_RE.exec(regex.slice(i))?.[0] ?? "(";
        group_starts.push(out.length);
        // JavaScript has no atomic groups; (?>...) keeps the group but allows backtracking.
        out += prefix === "(?>" ? "(?:" : prefix;
        last_was_quantifier = false;
        i += prefix.length;
        continue;
      }
      case ")":
        out += char;
        atom_start = group_starts.pop() ?? -1;
        last_was_quantifier = false;
        ++i;
        continue;
      case "|":
        out += char;
        atom_start = -1;
        last_was_quantifier = false;
        ++i;
        continue;
      case "{": {
        const quant = QUANTIFIER_BRACE_RE.exec(regex.slice(i));
        if (!quant || atom_start < 0) {
          // Not a quantifier (or nothing to quantify): a literal "{" in Oniguruma.
          emit_atom("\\{");
          ++i;
          continue;
        }
        const body = quant[1].startsWith(",") ? `0${quant[1]}` : quant[1];
        i += quant[0].length;
        const following = regex[i];
        if (following === "+" || following === "*") {
          // Oniguruma parses X{n}+ as the stacked quantifier (?:X{n})+, not as possessive.
          out = `${out.slice(0, atom_start)}(?:${out.slice(atom_start)}{${body}})${following}`;
          ++i;
        } else {
          out += `{${body}}`;
        }
        last_was_quantifier = true;
        continue;
      }
      case "}":
        // A stray "}" is a literal in Oniguruma but a syntax error with the 'u' flag.
        emit_atom("\\}");
        ++i;
        continue;
      case "+":
        if (last_was_quantifier) {
          // Possessive quantifier (e.g. a++): JavaScript has no equivalent; dropping the "+"
          // keeps the match set but allows backtracking the possessive form would forbid.
          ++i;
          continue;
        }
        out += char;
        last_was_quantifier = true;
        ++i;
        continue;
      case "*":
      case "?":
        out += char;
        last_was_quantifier = true;
        ++i;
        continue;
      default:
        emit_atom(char);
        ++i;
        continue;
    }
  }

  return out;
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
