import Decoder from "../Decoder";
import { TokenizerConfigDecoderSequence } from "@static/tokenizer";
import create_decoder from "./create_decoder";

/**
 * Apply a sequence of decoders.
 */
class Sequence extends Decoder {
  decoders: Decoder[];

  /**
   * Creates a new instance of DecoderSequence.
   * @param config The configuration object.
   */
  constructor(config: TokenizerConfigDecoderSequence) {
    super(config);
    this.decoders = (config.decoders ?? []).map((x) => create_decoder(x)!);
  }

  decode_chain(tokens: string[]): string[] {
    // Use reduce to apply each decoder to the tokens
    return this.decoders.reduce((toks, decoder) => {
      return decoder.decode_chain(toks);
    }, tokens);
  }
}

export default Sequence;
