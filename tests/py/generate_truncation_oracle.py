#!/usr/bin/env python3
"""Generate truncation oracle fixtures from the Python `tokenizers` library.

Run from the repository root with a Python environment that has `tokenizers`
installed:

    python tests/py/generate_truncation_oracle.py
"""

from __future__ import annotations

import json
from pathlib import Path

import tokenizers
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tests" / "fixtures" / "truncationOracle.json"

# One model per post-processor shape: TemplateProcessing ([CLS] A [SEP] / B [SEP]),
# RobertaProcessing (<s> A </s></s> B </s>), TemplateProcessing with only a
# trailing EOS, and ByteLevel, which adds nothing.
MODELS = [
    "Xenova/bert-base-uncased",
    "Xenova/all-MiniLM-L6-v2",
    "Xenova/roberta-base",
    "Xenova/t5-small",
    "Xenova/gpt2",
]

# The ByteLevel post-processor here drops the second sequence of a pair even
# without truncation, so GPT-2 is checked on single sequences only.
NO_PAIR_MODELS = {"Xenova/gpt2"}

LONG = "The quick brown fox jumps over the lazy dog while the cat watches from the old wooden fence."
MEDIUM = "A short second sentence about something else entirely."
SHORT = "Hi there."

# (name, text, text_pair, max_length, strategy, add_special_tokens)
CASES = [
    ("single_longest_first", LONG, None, 8, "longest_first", True),
    ("single_only_first", LONG, None, 8, "only_first", True),
    ("single_no_special_tokens", LONG, None, 8, "longest_first", False),
    ("single_fits_exactly", SHORT, None, None, "longest_first", True),
    ("pair_longest_first_both_long", LONG, MEDIUM, 12, "longest_first", True),
    ("pair_longest_first_short_kept", SHORT, LONG, 14, "longest_first", True),
    ("pair_longest_first_odd_budget", LONG, MEDIUM, 13, "longest_first", True),
    ("pair_only_first", LONG, SHORT, 14, "only_first", True),
    ("pair_only_second", SHORT, LONG, 14, "only_second", True),
    ("pair_no_special_tokens", LONG, MEDIUM, 10, "longest_first", False),
]


def main() -> None:
    fixtures: dict[str, dict] = {}
    for model_id in MODELS:
        tok = Tokenizer.from_pretrained(model_id)
        tok.no_truncation()
        tok.no_padding()
        cases = {}
        for name, text, pair, max_length, strategy, add_special in CASES:
            if pair is not None and model_id in NO_PAIR_MODELS:
                continue
            if max_length is None:
                # Exactly the untruncated length: the boundary must not cut.
                max_length = len(tok.encode(text, pair, add_special_tokens=add_special).ids)
            tok.enable_truncation(max_length, strategy=strategy)
            ids = tok.encode(text, pair, add_special_tokens=add_special).ids
            tok.no_truncation()
            cases[name] = {
                "text": text,
                "text_pair": pair,
                "max_length": max_length,
                "truncation": strategy,
                "add_special_tokens": add_special,
                "ids": ids,
            }
        fixtures[model_id] = cases

    payload = {"tokenizers_version": tokenizers.__version__, "models": fixtures}
    OUTPUT.write_text(json.dumps(payload, indent=1) + "\n")
    print(f"wrote {OUTPUT} ({len(MODELS)} models x {len(CASES)} cases)")


if __name__ == "__main__":
    main()
