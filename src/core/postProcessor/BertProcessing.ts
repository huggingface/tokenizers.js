import PostProcessor, { type PostProcessedOutput } from "../PostProcessor";
import { merge_arrays } from "@utils/core";

import type { TokenizerConfigPostProcessorBert } from "@static/tokenizer";

/**
 * A post-processor that adds special tokens to the beginning and end of the input.
 */
class BertProcessing extends PostProcessor {
  sep: [string, number];
  cls: [string, number];

  /**
   * @param config The configuration for the post-processor.
   * @param config.cls The special tokens to add to the beginning of the input.
   * @param config.sep The special tokens to add to the end of the input.
   */
  constructor(config: TokenizerConfigPostProcessorBert) {
    super(config);
    this.sep = config.sep;
    this.cls = config.cls;
  }

  /**
   * Adds the special tokens to the beginning and end of the input.
   * @param tokens The input tokens.
   * @param tokens_pair An optional second set of input tokens.
   * @param add_special_tokens Whether to add the special tokens to the beginning and end of the input.
   * @returns The post-processed tokens with the special tokens added to the beginning and end.
   */
  post_process(
    tokens: string[],
    tokens_pair: string[] = null,
    add_special_tokens: boolean = true,
  ): PostProcessedOutput {
    if (add_special_tokens) {
      tokens = merge_arrays([this.cls[0]], tokens, [this.sep[0]]);
    }

    let token_type_ids = new Array(tokens.length).fill(0);
    if (tokens_pair) {
      // NOTE: It is intended to add 2 EOS tokens after the first set of tokens
      // https://github.com/huggingface/tokenizers/issues/983
      const middle: Array<string> = [];
      const after = add_special_tokens ? [this.sep[0]] : [];

      tokens = merge_arrays(tokens, middle, tokens_pair, after);
      token_type_ids = merge_arrays(
        token_type_ids,
        new Array(tokens_pair.length + middle.length + after.length).fill(1),
      );
    }
    return { tokens, token_type_ids };
  }
}

export default BertProcessing;
