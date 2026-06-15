#!/usr/bin/env python3
"""Generate Python tokenizers Split regex oracle fixtures.

Run from the repository root with a Python environment that has `tokenizers`
installed:

    python tests/py/generate_split_regex_oracle.py
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any, Iterable

import tokenizers
from tokenizers import Regex
from tokenizers.pre_tokenizers import Split


ROOT = Path(__file__).resolve().parents[2]
PATTERNS_INPUT = ROOT / "tests" / "fixtures" / "splitRegexPatterns.json"
OUTPUT = ROOT / "tests" / "fixtures" / "splitRegexOracle.json.gz"


def load_pattern_fixture() -> dict[str, Any]:
    return json.loads(PATTERNS_INPUT.read_text())


def resolve_case(
    fixture: dict[str, Any],
    pattern_by_id: dict[str, dict[str, Any]],
    case: dict[str, Any],
) -> dict[str, Any]:
    defaults = fixture["defaults"]
    pattern = pattern_by_id[case["patternId"]]

    return {
        "name": case["name"],
        "patternId": case["patternId"],
        "pattern": pattern["pattern"],
        "behavior": case.get(
            "behavior", pattern.get("behavior", defaults["behavior"])
        ),
        "invert": case.get("invert", pattern.get("invert", defaults["invert"])),
        "knownDivergence": case.get(
            "knownDivergence", pattern.get("knownDivergence", False)
        ),
        "inputs": case.get("inputs", pattern.get("inputs", defaults["inputs"])),
    }


def iter_cases(fixture: dict[str, Any]) -> Iterable[dict[str, Any]]:
    pattern_by_id = {pattern["id"]: pattern for pattern in fixture["patterns"]}

    for pattern in fixture["patterns"]:
        yield resolve_case(
            fixture,
            pattern_by_id,
            {
                "name": pattern.get("name", pattern["id"]),
                "patternId": pattern["id"],
            },
        )

    for case in fixture.get("additionalCases", []):
        yield resolve_case(fixture, pattern_by_id, case)


def pre_tokenize(case: dict[str, Any], text: str) -> list[str]:
    pre_tokenizer = Split(
        Regex(case["pattern"]),
        behavior=case["behavior"].lower(),
        invert=case["invert"],
    )
    return [token for token, _offset in pre_tokenizer.pre_tokenize_str(text)]


def main() -> None:
    fixture = load_pattern_fixture()
    # Cases are emitted fully resolved (pattern/behavior/invert/knownDivergence included)
    # so the TypeScript oracle test does not need to re-implement the fixture's
    # case/pattern/defaults resolution rules.
    oracle = {
        "tokenizersVersion": tokenizers.__version__,
        "source": PATTERNS_INPUT.name,
        "cases": [
            {
                "name": case["name"],
                "patternId": case["patternId"],
                "pattern": case["pattern"],
                "behavior": case["behavior"],
                "invert": case["invert"],
                "knownDivergence": case["knownDivergence"],
                "expected": [
                    {"input": text, "tokens": pre_tokenize(case, text)}
                    for text in case["inputs"]
                ],
            }
            for case in iter_cases(fixture)
        ],
    }

    payload = json.dumps(oracle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime=0 keeps the output byte-stable so it only changes in git when the data changes.
    OUTPUT.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))


if __name__ == "__main__":
    main()
