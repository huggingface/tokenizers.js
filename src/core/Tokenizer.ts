import { TokenConfig, TokenizerConfig, TokenizerJSON } from "@static/tokenizer";
import DictionarySplitter from "@utils/data-structures/DictionarySplitter";
import AddedToken from "./AddedToken";
import {
  clean_up_tokenization,
  is_integral_number,
  lowercase_and_remove_accents,
  merge_arrays,
  validate_object,
} from "@utils/core";
import { Encoding } from "@static/types";
import type Normalizer from "./Normalizer";
import type PreTokenizer from "./PreTokenizer";
import type TokenizerModel from "./TokenizerModel";
import type PostProcessor from "./PostProcessor";
import type Decoder from "./Decoder";
import create_normalizer from "./normalizer/create_normalizer";
import create_pre_tokenizer from "./preTokenizer/create_pre_tokenizer";
import create_tokenizer_model from "./tokenizerModelImplementations/create_tokenizer_model";
import create_post_processor from "./postProcessor/create_post_processor";
import create_decoder from "./decoder/create_decoder";

interface EncodeOptions {
  text_pair?: string | null;
  add_special_tokens?: boolean;
  return_token_type_ids?: boolean | null;
}

interface DecodeOptions {
  skip_special_tokens?: boolean;
  clean_up_tokenization_spaces?: boolean | null;
}

interface TokenizeOptions {
  text_pair?: string | null;
  add_special_tokens?: boolean;
}

class Tokenizer {
  private tokenizer: TokenizerJSON;
  private config: TokenizerConfig;
  private normalizer: Normalizer;
  private pre_tokenizer: PreTokenizer;
  private model: TokenizerModel;
  private post_processor: PostProcessor;
  private decoder: Decoder;

  private added_tokens_splitter: DictionarySplitter;
  private added_tokens: Array<AddedToken>;
  private added_tokens_map: Map<string, AddedToken>;
  private special_tokens: Array<string | TokenConfig>;
  private all_special_ids: Array<number>;
  private remove_space: boolean;
  private clean_up_tokenization_spaces: boolean;
  private do_lowercase_and_remove_accent: boolean;

  public constructor(tokenizer: Object, config: Object) {
    const tokenizer_error = validate_object(tokenizer, "Tokenizer", [
      "model",
      "decoder",
      "post_processor",
      "pre_tokenizer",
      "normalizer",
    ]);
    if (tokenizer_error) {
      throw new Error(tokenizer_error);
    }

    const config_error = validate_object(config, "Config");
    if (config_error) {
      throw new Error(config_error);
    }

    this.tokenizer = tokenizer as TokenizerJSON;
    this.config = config as TokenizerConfig;

    this.normalizer = create_normalizer(this.tokenizer.normalizer);
    this.pre_tokenizer = create_pre_tokenizer(this.tokenizer.pre_tokenizer);
    this.model = create_tokenizer_model(this.tokenizer.model, this.config);
    this.post_processor = create_post_processor(this.tokenizer.post_processor);
    this.decoder = create_decoder(this.tokenizer.decoder);

    // Add added_tokens to model
    this.special_tokens = [];
    this.all_special_ids = [];
    this.added_tokens = [];

    this.tokenizer.added_tokens.forEach((added_token) => {
      const token = new AddedToken(added_token);
      this.added_tokens.push(token);
      this.model.tokens_to_ids.set(token.content, token.id);
      this.model.vocab[token.id] = token.content;

      if (token.special) {
        this.special_tokens.push(token.content);
        this.all_special_ids.push(token.id);
      }
    });

    (this.config.additional_special_tokens ?? []).forEach((token) => {
      if (!this.special_tokens.includes(token)) this.special_tokens.push(token);
    });

    if (this.decoder) {
      // Slight hack, but it prevents code duplication:
      this.decoder.added_tokens = this.added_tokens;

      // Another slight hack to add `end_of_word_suffix` (if present) to the decoder
      // This is needed for cases where BPE model and ByteLevel decoder are used
      // For more information, see https://github.com/huggingface/transformers.js/issues/74
      // TODO: save this to the decoder when exporting?
      this.decoder.end_of_word_suffix = this.model.end_of_word_suffix;
    }

    this.added_tokens_splitter = new DictionarySplitter(
      this.added_tokens.map((x) => x.content),
    );

    this.added_tokens_map = new Map(
      this.added_tokens.map((x) => [x.content, x]),
    );
    this.remove_space = this.config.remove_space;
    this.clean_up_tokenization_spaces =
      this.config.clean_up_tokenization_spaces ?? true;
    this.do_lowercase_and_remove_accent =
      this.config.do_lowercase_and_remove_accent ?? false;
  }

  /**
   * Encodes a single text or a pair of texts using the model's tokenizer.
   *
   * @param text The text to encode.
   * @param options An optional object containing the following properties:
   * @returns An object containing the encoded text.
   */

  // Overload: when return_token_type_ids is explicitly true
  public encode(
    text: string,
    options: EncodeOptions & { return_token_type_ids: true },
  ): Encoding & { token_type_ids: number[] };

  // Overload: when return_token_type_ids is false/null or not provided
  public encode(text: string, options?: EncodeOptions): Encoding;

  // Implementation
  public encode(
    text: string,
    {
      text_pair = null,
      add_special_tokens = true,
      return_token_type_ids = null,
    }: EncodeOptions = {},
  ): Encoding {
    const { tokens, token_type_ids } = this.tokenize_helper(text, {
      text_pair,
      add_special_tokens,
    });

    const input_ids = this.model.convert_tokens_to_ids(tokens);
    const result: Encoding = {
      ids: input_ids,
      tokens,
      attention_mask: new Array(input_ids.length).fill(1),
    };

    if (return_token_type_ids && token_type_ids) {
      result.token_type_ids = token_type_ids;
    }
    return result;
  }

  public decode(
    token_ids: Array<number> | Array<bigint>,
    options: DecodeOptions = {},
  ): string {
    if (
      !Array.isArray(token_ids) ||
      token_ids.length === 0 ||
      !is_integral_number(token_ids[0])
    ) {
      throw Error("token_ids must be a non-empty array of integers.");
    }

    let tokens = this.model.convert_ids_to_tokens(token_ids);
    if (options.skip_special_tokens) {
      tokens = tokens.filter((x) => !this.special_tokens.includes(x));
    }

    // If `this.decoder` is null, we just join tokens with a space:
    // https://github.com/huggingface/tokenizers/blob/8edec536a737cb04494b454805be16c020abb14f/tokenizers/src/tokenizer/mod.rs#L835
    let decoded: string = this.decoder
      ? this.decoder(tokens)
      : tokens.join(" ");

    // Slight hack, but prevents having to pass `skip_special_tokens` to
    // each call to `decode`, which would lead to code duplication.
    if (this.decoder && this.decoder.end_of_word_suffix) {
      decoded = decoded.replaceAll(this.decoder.end_of_word_suffix, " ");
      if (options.skip_special_tokens) {
        decoded = decoded.trim();
      }
    }

    if (
      options.clean_up_tokenization_spaces ??
      this.clean_up_tokenization_spaces
    ) {
      decoded = clean_up_tokenization(decoded);
    }

    return decoded;
  }

  /**
   * Converts a string into a sequence of tokens.
   * @param text The sequence to be encoded.
   * @param options An optional object containing the following properties:
   * @returns The list of tokens.
   */
  tokenize(
    text: string,
    { text_pair = null, add_special_tokens = false }: TokenizeOptions = {},
  ): string[] {
    return this.tokenize_helper(text, { text_pair, add_special_tokens }).tokens;
  }

  private encode_text(text: string | null): string[] | null {
    if (text === null) {
      return null;
    }

    // Actual function which does encoding, for a single text
    // First, we take care of special tokens. Needed to avoid issues arising from
    // normalization and/or pretokenization (which may not preserve special tokens)
    const sections = this.added_tokens_splitter.split(text);

    sections.forEach((section, i) => {
      const added_token = this.added_tokens_map.get(section);
      if (added_token) {
        if (added_token.lstrip && i > 0) {
          sections[i - 1] = sections[i - 1].trimEnd();
        }
        if (added_token.rstrip && i < sections.length - 1) {
          sections[i + 1] = sections[i + 1].trimStart();
        }
      }
    });

    return sections.flatMap((processed_text, section_index) => {
      if (processed_text.length === 0) {
        return [];
      }
      if (this.added_tokens_map.has(processed_text)) {
        return [processed_text]; // Return added tokens unchanged
      }

      if (this.remove_space === true) {
        processed_text = processed_text.trim().split(/\s+/).join(" ");
      }
      if (this.do_lowercase_and_remove_accent) {
        processed_text = lowercase_and_remove_accents(processed_text);
      }
      if (this.normalizer !== null) {
        processed_text = this.normalizer(processed_text);
      }
      // If, after normalization, this section is empty (e.g., trimming whitespace),
      // we return an empty array
      if (processed_text.length === 0) {
        return [];
      }

      const section_tokens =
        this.pre_tokenizer !== null
          ? this.pre_tokenizer(processed_text, {
              section_index,
            })
          : [processed_text];
      return this.model(section_tokens);
    });
  }

  private tokenize_helper(
    text: string,
    { text_pair = null, add_special_tokens = true }: TokenizeOptions,
  ): { tokens: Array<string>; token_type_ids?: Array<number> } {
    const tokens1 = this.encode_text(text);
    const tokens2 = this.encode_text(text_pair || null);

    return this.post_processor
      ? this.post_processor(tokens1, tokens2, add_special_tokens)
      : { tokens: merge_arrays(tokens1 ?? [], tokens2 ?? []) };
  }
}

export default Tokenizer;
