import Decoder from "../Decoder";
import { clean_up_tokenization } from "@utils/core";
import { TokenizerConfigDecoderWordPiece } from "@static/tokenizer";

/**
 * A decoder that decodes a list of WordPiece tokens into a single string.
 */
class WordPiece extends Decoder {
  declare config: TokenizerConfigDecoderWordPiece;
  cleanup?: boolean;

  /**
   * Creates a new instance of WordPieceDecoder.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigDecoderWordPiece) {
    super(config);
    this.cleanup = config.cleanup;
  }

  decode_chain(tokens: string[]): string[] {
    return tokens.map((token, i) => {
      if (i !== 0) {
        const prefix = this.config.prefix;
        if (prefix && token.startsWith(prefix)) {
          // NOTE: .replace() is intended; only replace first occurrence
          token = token.replace(prefix, "");
        } else {
          token = " " + token;
        }
      }
      if (this.cleanup) {
        token = clean_up_tokenization(token);
      }

      return token;
    });
  }
}

export default WordPiece;
