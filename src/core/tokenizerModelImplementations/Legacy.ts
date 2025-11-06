import TokenizerModel from "../TokenizerModel";
import { object_to_map } from "@utils/core";

import type { TokenizerModelConfigLegacy } from "@static/tokenizer";

/**
 * Legacy tokenizer class for tokenizers with only a vocabulary.
 */
class Legacy extends TokenizerModel {
  bos_token: string;
  bos_token_id?: number;
  eos_token: string;
  eos_token_id?: number;
  pad_token: string;
  pad_token_id?: number;

  /**
   * Create a Legacy tokenizer model instance.
   * @param config The configuration object for Legacy tokenizer model.
   * @param more_config Additional configuration object for the Legacy tokenizer model.
   */
  constructor(
    config: TokenizerModelConfigLegacy,
    more_config: {
      target_lang: string;
      bos_token: string;
      eos_token: string;
      pad_token: string;
      unk_token: string;
    },
  ) {
    super(config);

    const vocab = config.vocab!;
    this.tokens_to_ids = object_to_map(
      more_config.target_lang
        ? (vocab as Record<string, Record<string, number>>)[
            more_config.target_lang
          ]
        : (vocab as Record<string, number>),
    );

    this.bos_token = more_config.bos_token;
    this.bos_token_id = this.tokens_to_ids.get(this.bos_token);

    this.eos_token = more_config.eos_token;
    this.eos_token_id = this.tokens_to_ids.get(this.eos_token);

    this.pad_token = more_config.pad_token;
    this.pad_token_id = this.tokens_to_ids.get(this.pad_token);

    this.unk_token = more_config.unk_token;
    this.unk_token_id = this.tokens_to_ids.get(this.unk_token);

    this.vocab = new Array(this.tokens_to_ids.size);
    for (const [key, value] of this.tokens_to_ids) {
      this.vocab[value] = key;
    }
  }

  encode(tokens: string[]): string[] {
    return tokens;
  }
}

export default Legacy;
