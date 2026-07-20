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
      const property_names = new Map<string, string>();
      const fixed = regex.replace(/(\\[pP])\{([^}=]+)\}/g, (_, p, n) => {
        let property_name = property_names.get(n);
        if (property_name === undefined) {
          try {
            new RegExp(`\\p{${n}}`, "u");
            property_name = n;
          } catch {
            property_name = `Script=${n}`;
          }
          property_names.set(n, property_name);
        }
        if (property_name !== n) changed = true;
        return `${p}{${property_name}}`;
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
// are complements of unions, which JavaScript cannot express inside a class, so they are
// represented as complete character-set atoms and composed structurally below.
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

const POSIX_BRACKET_RE = /^\[:(\^?)([a-z]+):\]/;
const POSIX_COLLATING_RE = /^\[\.[^\]]*\.\]/;
const POSIX_EQUIVALENCE_RE = /^\[=[^\]]*=\]/;

const is_ascii_letter = (char: string): boolean =>
  (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");

const character_at = (string: string, index: number): string =>
  String.fromCodePoint(string.codePointAt(index)!);

// Used to override the default invalid regex of the Bloom pretokenizer:
// ` ?[^(\\s|[.,!?…。，、।۔،])]+`.
// For more information, see https://github.com/huggingface/transformers.js/issues/94
const normalize_bloom_split_char_class = (regex: string): string =>
  regex.replace(/\[\^\(\\s\|\[([^\]]+)\]\)\]/g, "[^()|\\s$1]");

const ANY_CODE_POINT = "[\\s\\S]";

// `range` awaits its right endpoint; after `complete_range`, a following hyphen is literal.
type CharacterClassTail = "scalar" | "set" | "range" | "complete_range" | null;

type CharacterClassOperand = {
  fragment: string;
  alternatives: string[];
  tail: CharacterClassTail;
};

type ParsedCharacterClass = {
  atom: string;
  end: number;
};

const create_character_class_operand = (): CharacterClassOperand => ({
  fragment: "",
  alternatives: [],
  tail: null,
});

const throw_character_class_range_error = (index: number): never => {
  throw new SyntaxError(
    `Unsupported range with a set-valued character-class operand at index ${index}`,
  );
};

const add_character_class_atom = (
  operand: CharacterClassOperand,
  atom: string,
  index: number,
): void => {
  if (operand.tail === "range") throw_character_class_range_error(index);
  operand.alternatives.push(atom);
  operand.tail = "set";
};

const append_character_class_range = (
  operand: CharacterClassOperand,
  range: string,
): void => {
  operand.fragment += range;
  operand.tail = "complete_range";
};

const append_character_class_fragment = (
  operand: CharacterClassOperand,
  fragment: string,
  set_valued = false,
  index = -1,
): void => {
  if (set_valued && operand.tail === "range") {
    throw_character_class_range_error(index);
  }
  if (operand.tail === "range") {
    append_character_class_range(operand, fragment);
    return;
  }
  operand.fragment += fragment;
  operand.tail = set_valued ? "set" : "scalar";
};

const rewrite_character_class_escape = (
  regex: string,
  index: number,
  operand: CharacterClassOperand,
): number => {
  const braced = BRACED_ESCAPE_RE.exec(regex.slice(index));
  if (braced) {
    const [text, kind, body] = braced;
    if (kind === "x") {
      append_character_class_fragment(operand, `\\u{${body}}`);
    } else if (body === "Word") {
      if (kind === "p") {
        append_character_class_fragment(
          operand,
          UNICODE_WORD_CHARS_IN_CLASS,
          true,
          index,
        );
      } else if (kind === "P") {
        add_character_class_atom(
          operand,
          `[^${UNICODE_WORD_CHARS_IN_CLASS}]`,
          index,
        );
      } else {
        append_character_class_fragment(operand, text);
      }
    } else {
      append_character_class_fragment(
        operand,
        text,
        kind === "p" || kind === "P",
        index,
      );
    }
    return index + text.length;
  }

  // These escapes are one source atom even though their spelling spans several code units.
  // Consuming them whole is important for deciding whether a following hyphen starts a range.
  const fixed_width =
    /^(?:\\x[0-9A-Fa-f]{2}|\\u[0-9A-Fa-f]{4}|\\c[A-Za-z])/.exec(
      regex.slice(index),
    );
  if (fixed_width) {
    append_character_class_fragment(operand, fixed_width[0]);
    return index + fixed_width[0].length;
  }

  if (index + 1 >= regex.length) {
    throw new SyntaxError(
      `Unterminated escape in character class at index ${index}`,
    );
  }

  const next = regex[index + 1];
  const raw_whitespace = RAW_WHITESPACE_ESCAPES.get(next);
  if (raw_whitespace !== undefined) {
    append_character_class_fragment(operand, raw_whitespace);
    return index + 2;
  }

  const complement = CLASS_COMPLEMENT_ALTERNATIVES.get(next);
  if (complement !== undefined) {
    add_character_class_atom(operand, complement, index);
    return index + 2;
  }

  const rewrite = CLASS_ESCAPE_REWRITES.get(next);
  let replacement: string;
  let set_valued = false;
  if (rewrite !== undefined) {
    replacement = rewrite;
    set_valued = next !== "a" && next !== "e";
  } else if (/[A-Za-z0-9]/.test(next)) {
    // Real escape classes, backreferences, \xNN, \uNNNN, \cX, etc.
    replacement = `\\${next}`;
  } else if (JS_SYNTAX_CHARS.includes(next) || next === "-") {
    replacement = `\\${next}`;
  } else {
    // Preserve the escaped token as a literal without allowing it to become syntax. In
    // particular, `\&\&` must not be reinterpreted as the intersection operator.
    replacement = next;
  }
  append_character_class_fragment(operand, replacement, set_valued, index);
  return index + 2;
};

const compile_character_class_operand = (
  operand: CharacterClassOperand,
): string => {
  const pieces: string[] = [];
  if (operand.fragment.length > 0) {
    pieces.push(`[${operand.fragment}]`);
  }
  pieces.push(...operand.alternatives);
  if (pieces.length === 1) return pieces[0];

  // All union branches are membership predicates; exactly one shared atom consumes the code
  // point. This avoids ambiguous consuming paths when branches overlap (e.g. `[\W!]`).
  return `(?:(?=(?:${pieces.join("|")}))${ANY_CODE_POINT})`;
};

// Parses a balanced Oniguruma character class and returns a JavaScript atom matching exactly
// one Unicode code point. Intersection has lower precedence than union, so each `&&` operand
// is first compiled as a union; lookaheads then test all operands at the same input position.
const parse_character_class = (
  regex: string,
  start: number,
  ascii_fold: boolean,
): ParsedCharacterClass => {
  let i = start + 1;
  const negated = regex[i] === "^";
  if (negated) ++i;

  const operands: CharacterClassOperand[] = [create_character_class_operand()];
  let operand = operands[0];
  let literal_closing_bracket_allowed = true;

  while (i < regex.length) {
    const char = character_at(regex, i);

    if (char === "\\") {
      i = rewrite_character_class_escape(regex, i, operand);
      literal_closing_bracket_allowed = false;
      continue;
    }

    if (char === "]") {
      if (literal_closing_bracket_allowed) {
        append_character_class_fragment(operand, "\\]");
        literal_closing_bracket_allowed = false;
        ++i;
        continue;
      }

      if (operand.tail === null) {
        if (operands.length > 1) {
          throw new SyntaxError(
            `Malformed character-class intersection with an empty operand at index ${i}`,
          );
        }
        throw new SyntaxError(`Empty character class at index ${start}`);
      }

      const first_atom = compile_character_class_operand(operands[0]);
      let positive_atom = first_atom;
      if (operands.length > 1) {
        let lookaheads = "";
        for (let j = 1; j < operands.length; ++j) {
          lookaheads += `(?=${compile_character_class_operand(operands[j])})`;
        }
        positive_atom = `(?:${lookaheads}${first_atom})`;
      }

      const is_direct_class =
        operands.length === 1 && operand.alternatives.length === 0;
      const atom = negated
        ? is_direct_class
          ? `[^${operand.fragment}]`
          : `(?:(?!${positive_atom})${ANY_CODE_POINT})`
        : positive_atom;
      return { atom, end: i + 1 };
    }

    if (regex.startsWith("&&", i)) {
      if (operand.tail === null) {
        throw new SyntaxError(
          `Malformed character-class intersection with an empty operand at index ${i}`,
        );
      }
      operand = create_character_class_operand();
      operands.push(operand);
      literal_closing_bracket_allowed = false;
      i += 2;
      continue;
    }

    if (char === "[") {
      const suffix = regex.slice(i);
      const posix = POSIX_BRACKET_RE.exec(suffix);
      if (posix) {
        const [, posix_negated, name] = posix;
        let fragment = POSIX_CLASS_FRAGMENTS[name];
        if (fragment === undefined) {
          throw new SyntaxError(
            `Unsupported POSIX character class "${name}" at index ${i}`,
          );
        }
        const opposite_ascii_range =
          ascii_fold && name === "lower"
            ? "A-Z"
            : ascii_fold && name === "upper"
              ? "a-z"
              : null;
        if (opposite_ascii_range !== null && posix_negated) {
          throw new SyntaxError(
            `Unsupported negated POSIX ${name} class inside an inline case-insensitive group`,
          );
        }
        if (opposite_ascii_range !== null) fragment += opposite_ascii_range;

        if (posix_negated) {
          add_character_class_atom(operand, `[^${fragment}]`, i);
        } else {
          append_character_class_fragment(operand, fragment, true, i);
        }
        i += posix[0].length;
        literal_closing_bracket_allowed = false;
        continue;
      }

      if (
        POSIX_COLLATING_RE.test(suffix) ||
        POSIX_EQUIVALENCE_RE.test(suffix)
      ) {
        throw new SyntaxError(
          `Unsupported POSIX collating or equivalence bracket expression at index ${i}`,
        );
      }

      const nested = parse_character_class(regex, i, ascii_fold);
      add_character_class_atom(operand, nested.atom, i);
      i = nested.end;
      literal_closing_bracket_allowed = false;
      continue;
    }

    if (char === "-") {
      const is_terminal_literal =
        regex[i + 1] === "]" || regex.startsWith("&&", i + 1);
      if (operand.tail === "set" && !is_terminal_literal) {
        throw_character_class_range_error(i);
      }

      if (
        operand.tail === null ||
        operand.tail === "range" ||
        operand.tail === "complete_range" ||
        is_terminal_literal
      ) {
        append_character_class_fragment(operand, "\\-");
      } else {
        operand.fragment += "-";
        operand.tail = "range";
      }
      literal_closing_bracket_allowed = false;
      ++i;
      continue;
    }

    if (
      ascii_fold &&
      is_ascii_letter(char) &&
      operand.tail !== "range" &&
      regex[i + 1] === "-" &&
      regex[i + 2] !== undefined &&
      regex[i + 2] !== "]" &&
      !regex.startsWith("&&", i + 2) &&
      regex[i + 2] !== "[" &&
      regex[i + 2] !== "\\"
    ) {
      const range_end = character_at(regex, i + 2);
      const range = `${char}-${range_end}`;
      const folded =
        range === range.toLowerCase()
          ? range.toUpperCase()
          : range.toLowerCase();
      append_character_class_range(operand, `${range}${folded}`);
      literal_closing_bracket_allowed = false;
      i += 2 + range_end.length;
      continue;
    }

    const should_fold = ascii_fold && is_ascii_letter(char);
    let folded_char = char;
    if (should_fold) {
      const lower = char.toLowerCase();
      const upper = char.toUpperCase();
      // A range endpoint stays first so folding cannot make a descending range valid.
      folded_char =
        operand.tail === "range"
          ? `${char}${char === lower ? upper : lower}`
          : `${lower}${upper}`;
    }
    append_character_class_fragment(
      operand,
      char === "^" && operand.fragment.length === 0 ? "\\^" : folded_char,
      should_fold && operand.tail !== "range",
      i,
    );
    literal_closing_bracket_allowed = false;
    i += char.length;
  }

  throw new SyntaxError(
    `${operands.length > 1 ? "Unterminated character-class intersection" : "Unterminated character class"} at index ${start}`,
  );
};

// The main Oniguruma -> JavaScript rewrite: one structural pass for groups, escapes,
// shorthands, anchors, quantifiers, inline case folding, and character classes.
const rewrite_oniguruma_to_js = (regex: string): string => {
  let out = "";
  let atom_start = -1; // index in `out` of the last complete atom, or -1
  let last_was_quantifier = false;
  let ascii_fold = false;
  const group_starts: number[] = [];
  const group_ascii_folds: boolean[] = [];

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
            kind === "p" ? UNICODE_WORD_CLASS : UNICODE_NON_WORD_CLASS;
        }
        emit_atom(replacement);
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

      if (next === "G") {
        // \G (continuation anchor) has no JavaScript equivalent. Hub patterns use it as a
        // match-chaining optimization; dropping it is a documented approximation.
        continue;
      }

      const raw_whitespace = RAW_WHITESPACE_ESCAPES.get(next);
      if (raw_whitespace !== undefined) {
        // An escaped literal whitespace character (valid in Oniguruma, invalid with 'u').
        emit_atom(raw_whitespace);
        continue;
      }

      const rewrite = ESCAPE_REWRITES.get(next);
      let replacement: string;
      if (rewrite !== undefined) {
        replacement = rewrite;
      } else if (/[A-Za-z0-9]/.test(next)) {
        // Real escape classes, backreferences, \xNN, \uNNNN, \cX, etc.
        replacement = `\\${next}`;
      } else if (JS_SYNTAX_CHARS.includes(next)) {
        replacement = `\\${next}`;
      } else {
        // Oniguruma identity escape of punctuation (e.g. \# or \"): drop the backslash.
        replacement = next;
      }
      emit_atom(replacement);
      continue;
    }

    switch (char) {
      case "[": {
        const parsed = parse_character_class(regex, i, ascii_fold);
        emit_atom(parsed.atom);
        i = parsed.end;
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
        const inline_case_insensitive = regex.startsWith("(?i:", i);
        const source_prefix = inline_case_insensitive
          ? "(?i:"
          : (GROUP_PREFIX_RE.exec(regex.slice(i))?.[0] ?? "(");
        const output_prefix = inline_case_insensitive
          ? "(?:"
          : source_prefix === "(?>"
            ? "(?:"
            : source_prefix;

        group_starts.push(out.length);
        group_ascii_folds.push(ascii_fold);
        if (inline_case_insensitive) ascii_fold = true;
        // JavaScript has no atomic groups; (?>...) keeps the group but allows backtracking.
        out += output_prefix;
        last_was_quantifier = false;
        i += source_prefix.length;
        continue;
      }
      case ")":
        out += char;
        atom_start = group_starts.pop() ?? -1;
        ascii_fold = group_ascii_folds.pop() ?? false;
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
        emit_atom(
          ascii_fold && is_ascii_letter(char)
            ? `[${char.toLowerCase()}${char.toUpperCase()}]`
            : char,
        );
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
