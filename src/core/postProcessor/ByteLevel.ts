import PostProcessor, { type PostProcessedOutput } from "../PostProcessor";
import { merge_arrays } from "@utils/core";

/**
 * A PostProcessor that returns the given tokens as is.
 */
class ByteLevel extends PostProcessor {
  /**
   * Post process the given tokens.
   * @param tokens The list of tokens for the first sequence.
   * @param tokens_pair The list of tokens for the second sequence (optional).
   * @returns An object containing the post-processed tokens.
   */
  post_process(
    tokens: string[],
    tokens_pair: string[] = null,
  ): PostProcessedOutput {
    const merged_tokens = !tokens_pair
      ? tokens
      : merge_arrays(tokens, tokens_pair);
    return { tokens: merged_tokens };
  }
}

export default ByteLevel;
