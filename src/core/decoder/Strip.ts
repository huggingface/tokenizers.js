import Decoder from "../Decoder";
import { TokenizerConfigDecoderStrip } from "@static/tokenizer";

class Strip extends Decoder {
  content: string;
  start: number;
  stop: number;

  constructor(config: TokenizerConfigDecoderStrip) {
    super(config);

    this.content = config.content ?? "";
    this.start = config.start ?? 0;
    this.stop = config.stop ?? 0;
  }

  decode_chain(tokens: string[]): string[] {
    return tokens.map((token) => {
      let start_cut = 0;
      for (let i = 0; i < this.start; ++i) {
        if (token[i] === this.content) {
          start_cut = i + 1;
          continue;
        } else {
          break;
        }
      }

      let stop_cut = token.length;
      for (let i = 0; i < this.stop; ++i) {
        const index = token.length - i - 1;
        if (token[index] === this.content) {
          stop_cut = index;
          continue;
        } else {
          break;
        }
      }

      return token.slice(start_cut, stop_cut);
    });
  }
}

export default Strip;
