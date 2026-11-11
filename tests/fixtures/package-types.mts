import { Tokenizer, type Encoding } from "@huggingface/tokenizers";

declare const tokenizer: Tokenizer;
const encoding: Encoding = tokenizer.encode("Hello World");

// @ts-expect-error Encoded token IDs are numbers.
const stringIds: string[] = encoding.ids;
