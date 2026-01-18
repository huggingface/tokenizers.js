export const BYTES_TO_UNICODE = (() => {
  // Returns list of utf-8 byte and a mapping to unicode strings.
  // We specifically avoids mapping to whitespace/control characters
  // the bpe code barfs on.

  const bs = [
    ...Array.from(
      { length: "~".charCodeAt(0) - "!".charCodeAt(0) + 1 },
      (_, i) => i + "!".charCodeAt(0),
    ),
    ...Array.from(
      { length: "¬".charCodeAt(0) - "¡".charCodeAt(0) + 1 },
      (_, i) => i + "¡".charCodeAt(0),
    ),
    ...Array.from(
      { length: "ÿ".charCodeAt(0) - "®".charCodeAt(0) + 1 },
      (_, i) => i + "®".charCodeAt(0),
    ),
  ];
  const cs = bs.slice();
  let n = 0;
  for (let b = 0; b < 256; ++b) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n += 1;
    }
  }
  const ccs = cs.map((n) => String.fromCharCode(n));
  return Object.fromEntries(bs.map((b, i) => [b, ccs[i]]));
})();

const reverse_dictionary = (data: Object) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [value, key]));

export const UNICODE_TO_BYTES = reverse_dictionary(BYTES_TO_UNICODE);

const BLOOM_SPLIT_CHARS = ".,!?\u2026\u3002\uff0c\u3001\u0964\u06d4\u060c";

export const PROBLEMATIC_REGEX_MAP = new Map([
  // These uses the case insensitive group modifier, which is not supported in JavaScript.
  // When parsing the regex, an "Invalid group" error is thrown.
  [
    "(?i:'s|'t|'re|'ve|'m|'ll|'d)",
    "(?:'([sS]|[tT]|[rR][eE]|[vV][eE]|[mM]|[lL][lL]|[dD]))",
  ],
  [
    "(?i:[sdmt]|ll|ve|re)",
    "(?:[sS]|[dD]|[mM]|[tT]|[lL][lL]|[vV][eE]|[rR][eE])",
  ],

  // JS doesn't support possessive quantifiers (these are used in recent OpenAI tokenizers).
  ["[^\\r\\n\\p{L}\\p{N}]?+", "[^\\r\\n\\p{L}\\p{N}]?"],
  ["[^\\s\\p{L}\\p{N}]++", "[^\\s\\p{L}\\p{N}]+"],

  // Used to override the default (invalid) regex of the bloom pretokenizer.
  // For more information, see https://github.com/huggingface/transformers.js/issues/94
  [` ?[^(\\s|[${BLOOM_SPLIT_CHARS}])]+`, ` ?[^\\s${BLOOM_SPLIT_CHARS}]+`],
]);

export const PUNCTUATION_REGEX =
  "\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E";
