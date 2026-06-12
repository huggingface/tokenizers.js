<p align="center">
    <br/>
    <picture> 
        <source media="(prefers-color-scheme: dark)" srcset="https://huggingface.co/datasets/nico-martin/tokenizers.js/raw/main/tokenizersjs-dark.svg" width="500" style="max-width: 100%;">
        <source media="(prefers-color-scheme: light)" srcset="https://huggingface.co/datasets/nico-martin/tokenizers.js/raw/main/tokenizersjs-light.svg" width="500" style="max-width: 100%;">
        <img alt="transformers.js javascript library logo" src="https://huggingface.co/datasets/nico-martin/tokenizers.js/raw/main/tokenizersjs-light.svg" width="500" style="max-width: 100%;">
    </picture>
    <br/>
</p>

<p align="center">
    <a href="https://github.com/huggingface/tokenizers.js/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/huggingface/transformers.js?color=blue"></a>
</p>

<h3 align="center">
  <p>A lightweight tokenizer for the Web</p>
</h3>

Run today's most used tokenizers directly in your browser or Node.js application. No heavy dependencies, no server required. Just fast, client-side tokenization compatible with thousands of models on the Hugging Face Hub. These tokenizers are also used in [🤗 Transformers.js](https://github.com/huggingface/transformers.js)

## Features

- Lightweight (~ 8.3kB gzip)
- Zero dependencies
- Works in browsers and Node.js

## Installation

```bash
npm install @huggingface/tokenizers
```

Alternatively, you can use it via a CDN as follows:

```html
<script type="module">
  import { Tokenizer } from "https://cdn.jsdelivr.net/npm/@huggingface/tokenizers";
</script>
```

## Usage

```javascript
import { Tokenizer } from "@huggingface/tokenizers";

// Load files from the Hugging Face Hub
const modelId = "HuggingFaceTB/SmolLM3-3B";
const tokenizerJson = await fetch(`https://huggingface.co/${modelId}/resolve/main/tokenizer.json`).then((res) => res.json());
const tokenizerConfig = await fetch(`https://huggingface.co/${modelId}/resolve/main/tokenizer_config.json`).then((res) => res.json());

// Create tokenizer
const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

// Tokenize text
const tokens = tokenizer.tokenize("Hello World"); // ['Hello', 'ĠWorld']
const encoded = tokenizer.encode("Hello World"); // { ids: [9906, 4435], tokens: ['Hello', 'ĠWorld'], attention_mask: [1, 1] }
const decoded = tokenizer.decode(encoded.ids); // 'Hello World'
```

## Requirements

This library expects two files from Hugging Face models:

- `tokenizer.json` - Contains the tokenizer configuration
- `tokenizer_config.json` - Contains additional metadata

## Regex compatibility

Tokenizer configs are usually produced for Python/Rust tokenizers, whose regex syntax and Unicode behavior do not always match JavaScript `RegExp`. Tokenizers.js normalizes common differences in-library, including Python-only identity escapes, Unicode-aware `\w`/`\d` shorthands, selected anchors, inline case-insensitive groups, possessive quantifiers, atomic groups, and other regex patterns seen in tokenizer configs on the Hugging Face Hub.

The test suite includes Python-generated oracle fixtures for regex `Split` pre-tokenizers. These compare Python `tokenizers` output with the JavaScript implementation for edge cases such as Hebrew word characters, non-ASCII digits, escaped quote/backslash patterns, contractions, lookarounds, script ranges, and repeated punctuation.

Some regex behavior is still a known limitation. In particular, `\G`, full Unicode case folding, unsupported regex constructs, and `Split` behaviors such as `MergedWithPrevious`, `MergedWithNext`, and `Contiguous` may differ from Python/Rust tokenizers.

## Components

Tokenizers.js supports [Hugging Face tokenizer components](https://huggingface.co/docs/tokenizers/components):

### Normalizers

- NFD
- NFKC
- NFC
- NFKD
- Lowercase
- Strip
- StripAccents
- Replace
- BERT Normalizer
- Precompiled
- Sequence

### Pre-tokenizers

- BERT
- ByteLevel
- Whitespace
- WhitespaceSplit
- Metaspace
- CharDelimiterSplit
- Split
- Punctuation
- Digits

### Models

- BPE (Byte-Pair Encoding)
- WordPiece
- Unigram
- Legacy

### Post-processors

- ByteLevel
- TemplateProcessing
- RobertaProcessing
- BertProcessing
- Sequence

### Decoders

- ByteLevel
- WordPiece
- Metaspace
- BPE
- CTC
- Replace
- Fuse
- Strip
- ByteFallback
- Sequence
