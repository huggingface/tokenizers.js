import PostProcessor, { type PostProcessedOutput } from "../PostProcessor";
import { merge_arrays } from "@utils/core";

import type { TokenizerConfigPostProcessorTemplateProcessing } from "@static/tokenizer";

/**
 * Post processor that replaces special tokens in a template with actual tokens.
 */
class TemplateProcessing extends PostProcessor {
  declare config: TokenizerConfigPostProcessorTemplateProcessing;

  /**
   * Replaces special tokens in the template with actual tokens.
   * @param tokens The list of tokens for the first sequence.
   * @param tokens_pair The list of tokens for the second sequence (optional).
   * @param add_special_tokens Whether to add the special tokens to the beginning and end of the input.
   * @returns An object containing the list of tokens with the special tokens replaced with actual tokens.
   */
  post_process(
    tokens: string[],
    tokens_pair: string[] = null,
    add_special_tokens: boolean = true,
  ): PostProcessedOutput {
    const type = tokens_pair === null ? this.config.single : this.config.pair;

    let processed_tokens = [];
    let types = [];
    for (const item of type) {
      if ("SpecialToken" in item) {
        if (add_special_tokens) {
          processed_tokens.push(item.SpecialToken.id);
          types.push(item.SpecialToken.type_id);
        }
      } else if ("Sequence" in item) {
        if (item.Sequence.id === "A") {
          processed_tokens = merge_arrays(processed_tokens, tokens);
          types = merge_arrays(
            types,
            new Array(tokens.length).fill(item.Sequence.type_id),
          );
        } else if (item.Sequence.id === "B") {
          processed_tokens = merge_arrays(processed_tokens, tokens_pair);
          types = merge_arrays(
            types,
            new Array(tokens_pair.length).fill(item.Sequence.type_id),
          );
        }
      }
    }

    return { tokens: processed_tokens, token_type_ids: types };
  }
}

export default TemplateProcessing;
