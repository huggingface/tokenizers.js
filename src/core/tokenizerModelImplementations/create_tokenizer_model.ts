import WordPiece from "./WordPiece";
import Unigram from "./Unigram";
import BPE from "./BPE";
import Legacy from "./Legacy";

import type TokenizerModel from "../TokenizerModel";
import type { TokenizerModelConfig, TokenizerConfig } from "@static/tokenizer";

function create_tokenizer_model(
  model_config: TokenizerModelConfig,
  config: TokenizerConfig,
): TokenizerModel {
  switch (model_config.type) {
    case "WordPiece":
      return new WordPiece(model_config);
    case "Unigram":
      return new Unigram(model_config, config.eos_token);
    case "BPE":
      return new BPE(model_config);
    default:
      // Some older tokenizers do not have a `type` field.
      // Infer the tokenizer type based on the structure of the `vocab` field.
      if (model_config.vocab) {
        if (Array.isArray(model_config.vocab)) {
          // @ts-ignore
          return new Unigram(model_config, config.eos_token);
        } else if (
          Object.hasOwn(model_config, "continuing_subword_prefix") &&
          Object.hasOwn(model_config, "unk_token")
        ) {
          if (Object.hasOwn(model_config, "merges")) {
            // @ts-ignore
            return new BPE(model_config);
          } else {
            // @ts-ignore
            return new WordPiece(model_config);
          }
        } else {
          return new Legacy(model_config, {
            target_lang: config.target_lang,
            bos_token: config.bos_token,
            eos_token: config.eos_token,
            pad_token: config.pad_token,
            unk_token: config.unk_token,
          });
        }
      }
      throw new Error(
        `Unknown TokenizerModel type: ${(model_config as any)?.type}`,
      );
  }
}

export default create_tokenizer_model;
