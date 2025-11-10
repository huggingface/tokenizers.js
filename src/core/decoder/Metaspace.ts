import Decoder from "../Decoder";
import { TokenizerConfigDecoderMetaspace } from "@static/tokenizer";

/**
 * MetaspaceDecoder class extends the Decoder class and decodes Metaspace tokenization.
 */
class Metaspace extends Decoder {
  replacement: string;

  /**
   * Constructs a new MetaspaceDecoder object.
   * @param config The configuration object for the MetaspaceDecoder.
   */
  constructor(config: TokenizerConfigDecoderMetaspace) {
    super(config);

    this.replacement = config.replacement ?? "▁";
  }

  decode_chain(tokens: string[]): string[] {
    const result = [];
    for (let i = 0; i < tokens.length; ++i) {
      let normalized = tokens[i].replaceAll(this.replacement, " ");
      if (i == 0 && normalized.startsWith(" ")) {
        normalized = normalized.substring(1);
      }
      result.push(normalized);
    }
    return result;
  }
}

export default Metaspace;
