import PostProcessor, { type PostProcessedOutput } from "../PostProcessor";
import create_post_processor from "./create_post_processor";

import type { TokenizerConfigPostProcessorSequence } from "@static/tokenizer";

/**
 * A post-processor that applies multiple post-processors in sequence.
 */
class Sequence extends PostProcessor {
  processors: PostProcessor[];

  /**
   * Creates a new instance of Sequence post-processor.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigPostProcessorSequence) {
    super(config);
    this.processors = (
      (config as TokenizerConfigPostProcessorSequence).processors ?? []
    ).map((x) => create_post_processor(x)!);
  }

  /**
   * Post process the given tokens.
   * @param tokens The list of tokens for the first sequence.
   * @param tokens_pair The list of tokens for the second sequence (optional).
   * @param add_special_tokens Whether to add the special tokens to the beginning and end of the input.
   * @returns An object containing the post-processed tokens.
   */
  post_process(
    tokens: string[],
    tokens_pair: string[] = null,
    add_special_tokens: boolean = true,
  ): PostProcessedOutput {
    let processed_tokens: PostProcessedOutput = { tokens, tokens_pair };

    for (const processor of this.processors) {
      processed_tokens = processor.post_process(
        processed_tokens.tokens,
        processed_tokens.tokens_pair,
        add_special_tokens,
      );
    }

    return processed_tokens;
  }
}

export default Sequence;
