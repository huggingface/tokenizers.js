import Decoder from "../Decoder";

import type { TokenizerConfigDecoderBPE } from "@static/tokenizer";

class BPE extends Decoder {
  suffix: string;

  constructor(config: TokenizerConfigDecoderBPE) {
    super(config);

    this.suffix = config.suffix ?? "";
  }

  decode_chain(tokens: string[]): string[] {
    return tokens.map((token, i) => {
      return token.replaceAll(this.suffix, i === tokens.length - 1 ? "" : " ");
    });
  }
}

export default BPE;
