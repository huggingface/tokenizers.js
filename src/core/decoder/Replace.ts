import Decoder from "../Decoder";
import { create_pattern } from "@utils/core";
import { TokenizerConfigDecoderReplace } from "@static/tokenizer";

class Replace extends Decoder {
  declare config: TokenizerConfigDecoderReplace;
  decode_chain(tokens: string[]): string[] {
    const pattern = create_pattern(this.config.pattern);
    const content = this.config.content ?? "";
    return pattern === null
      ? tokens
      : tokens.map((token) => token.replaceAll(pattern, content));
  }
}

export default Replace;
