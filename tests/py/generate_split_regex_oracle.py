#!/usr/bin/env python3
"""Generate Python tokenizers Split regex oracle fixtures.

Run from the repository root with a Python environment that has `tokenizers`
installed:

    python tests/py/generate_split_regex_oracle.py
"""

from __future__ import annotations

import json
from pathlib import Path

import tokenizers
from tokenizers import Regex
from tokenizers.pre_tokenizers import Split


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tests" / "fixtures" / "splitRegexOracle.json"


CASES = [
    {
        "name": "issue 23 escaped quote and backslash pattern",
        "pattern": r"['\\\"]",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["' \\\"", "abc'def\"ghi\\j", "no quotes"],
    },
    {
        "name": "unicode word matches",
        "pattern": r"\w+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["hello, שלום 123", "abc_123 café", "नमस्ते world"],
    },
    {
        "name": "issue 23 unicode word matches inside character class",
        "pattern": r"[\w]+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["hi שלום", "abc_123 café", "مرحبا_١٢٣"],
    },
    {
        "name": "unicode digit matches",
        "pattern": r"\d+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["abc 123 १२३", "room ４２", "٣ apples"],
    },
    {
        "name": "issue 23 unicode non-digit matches",
        "pattern": r"\D+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["abc 123 १२३", "room ４２", "٣ apples"],
    },
    {
        "name": "issue 23 unicode non-word matches",
        "pattern": r"\W+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["hello, שלום 123", "abc_123 café!", "नमस्ते-world"],
    },
    {
        "name": "mixed shorthand tokenizer pattern",
        "pattern": r"\s+|\w+|[^\w\s]+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["hello, שלום!", "नमस्ते-world १२३", "emoji🙂test"],
    },
    {
        "name": "whitespace isolated",
        "pattern": r"\s+",
        "behavior": "Isolated",
        "invert": False,
        "inputs": ["hello  world", "a\n\tb", "trim "]
    },
    {
        "name": "whitespace removed",
        "pattern": r"\s+",
        "behavior": "Removed",
        "invert": False,
        "inputs": ["hello  world", "a\n\tb", " trim "]
    },
    {
        "name": "gpt2 style unicode pieces",
        "pattern": r"'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["Hello, world! 123 can't", "café déjà vu", "שלום עולם 42"],
    },
    {
        "name": "case insensitive contractions",
        "pattern": r"(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["I'm testing, you're testing.", "WE'RE here", "abc1234"],
    },
    {
        "name": "french case insensitive contractions",
        "pattern": r"(?i: ?(?:[jtmslndcy]['’]|qu['’]|jusqu['’]|lorsqu['’]|puisqu['’]|quoiqu['’]|aujourd['’]hui)|['’][stmd]|['’][rv]e|['’]ll)| ?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["j’aime qu’il vienne", "QU’IL arrive", "Aujourd’hui AUJOURD’HUI"],
    },
    {
        "name": "openai possessive quantifiers",
        "pattern": r"'(?i:[sdmt]|ll|ve|re)|[^\r\n\p{L}\p{N}]?+\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]++[\r\n]*|\s*[\r\n]|\s+(?!\S)|\s+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["Hello!!!", "can't stop", "A\nB"],
    },
    {
        "name": "atomic digit chunks",
        "pattern": r"\p{Nd}{1,510}(?=(?>\p{Nd}{510})*(?:\P{Nd}|$))|\G\p{Nd}{510}",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["1234567890", "abc123", "１２３４５６７８９０"],
    },
    {
        "name": "absolute digit chunk anchors",
        "pattern": r"\A\p{Nd}{1,2}(?=\p{Nd}{3}+\z)",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["12345", "123456", "abc12345", "１２３４５"],
    },
    {
        "name": "line start negative lookbehind",
        "pattern": r"(?<!\n)^ ",
        "behavior": "Removed",
        "invert": True,
        "inputs": [" leading", "no leading", "line\n leading"],
    },
    {
        "name": "bengali colon lookbehind",
        "pattern": r"(?<=[\u0980-\u09ff]):",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["বাংলা: text", "abc: text", "অ:আ"],
    },
    {
        "name": "horizontal whitespace",
        "pattern": r"(?i:'s|'t|'re|'ve|'m|'ll|'d)| (?!\h?\p{N})\h?(?:\p{L}\p{M}*)+|\p{N}| ?[^\s\p{L}\p{N}\p{M}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["abc 123 def", "a\tb", " 42 answer", " I'm here"],
    },
    {
        "name": "smiles tokens",
        "pattern": r"(\[[^\]]+]|Br?|Cl?|N|O|S|P|F|I|b|c|n|o|s|p|\(|\)|\.|=|#|-|\+|\\|\/|:|~|@|\?|>>?|\*|\$|\%[0-9]{2}|[0-9])",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["CC(=O)O", "ClCBr", "[NH4+]"],
    },
    {
        "name": "repeated punctuation backreference",
        "pattern": r"[\(\)\[\]\{\}]|([!\"\#\$%\&'\*\+,\-\./:;<=>\?\\\^_`\|\~])\1*",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["hello!!!??", "foo---bar", "((test))"],
    },
    {
        "name": "unicode category case aware words",
        "pattern": r"[^\r\n\p{L}\p{N}]?[\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{M}]*[\p{Ll}\p{Lm}\p{Lo}\p{M}]+|[^\r\n\p{L}\p{N}]?[\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{M}]+[\p{Ll}\p{Lm}\p{Lo}\p{M}]*|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n/]*|\s*[\r\n]+|\s+(?!\S)|\s+",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["Hello WORLD", "e\u0301clair café", "שלום עולם 42"],
    },
    {
        "name": "cjk and southeast asian ranges",
        "pattern": r"(?:[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\uf900-\uFAFF\uFF65-\uFF9F\u2F00-\u2FDF]+|[\u0E00-\u0E7F]+|[\u0E80-\u0EFF]+|[\u1780-\u17FF]+|[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]+|[\uAC00-\uD7AF\u1100-\u11FF]+)",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["中文かなカナ", "ไทย Lao ລາວ", "한국어 abc"],
    },
    {
        "name": "newline escaped pattern",
        "pattern": "\\\n(?=[ \\w])",
        "behavior": "Removed",
        "invert": True,
        "inputs": ["a\\\nb", "a\nb", "\\\n word"],
    },
]


def pre_tokenize(case: dict, text: str) -> list[str]:
    pre_tokenizer = Split(
        Regex(case["pattern"]),
        behavior=case["behavior"].lower(),
        invert=case["invert"],
    )
    return [token for token, _offset in pre_tokenizer.pre_tokenize_str(text)]


def main() -> None:
    fixture = {
        "tokenizersVersion": tokenizers.__version__,
        "cases": [
            {
                **case,
                "expected": [
                    {"input": text, "tokens": pre_tokenize(case, text)}
                    for text in case["inputs"]
                ],
            }
            for case in CASES
        ],
    }

    OUTPUT.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
