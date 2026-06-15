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
    # The oracle stores only the expected tokens (the one thing not derivable from
    # splitRegexPatterns.json), keyed by case name. The TypeScript test re-resolves each
    # case's pattern/behavior/invert/inputs from the same input fixture. Token lists are
    # ordered to match each case's resolved `inputs`.
    tokens_by_name: dict[str, list[list[str]]] = {}
    for case in iter_cases(fixture):
        name = case["name"]
        if name in tokens_by_name:
            raise ValueError(f"Duplicate case name: {name!r}")
        tokens_by_name[name] = [pre_tokenize(case, text) for text in case["inputs"]]

    oracle = {"tokenizersVersion": tokenizers.__version__, "tokens": tokens_by_name}
    payload = json.dumps(oracle, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # mtime=0 keeps the output byte-stable so it only changes in git when the data changes.
    OUTPUT.write_bytes(gzip.compress(payload, compresslevel=9, mtime=0))


if __name__ == "__main__":
    main()
