import ByteLevel from "./ByteLevel";
import Whitespace from "./Whitespace";
import Metaspace from "./Metaspace";
import Split from "./Split";
import Punctuation from "./Punctuation";
import Digits from "./Digits";
import BertPreTokenizer from "./BertPreTokenizer";
import Replace from "./Replace";
import Sequence from "./Sequence";
import WhitespaceSplit from "./WhitespaceSplit";
import FixedLength from "./FixedLength";

import type PreTokenizer from "../PreTokenizer";
import type { TokenizerConfigPreTokenizer } from "@static/tokenizer";

function create_pre_tokenizer(
  config: TokenizerConfigPreTokenizer,
): PreTokenizer | null {
  if (config === null) return null;

  switch (config.type) {
    case "BertPreTokenizer":
      return new BertPreTokenizer();
    case "Sequence":
      return new Sequence(config);
    case "Whitespace":
      return new Whitespace();
    case "WhitespaceSplit":
      return new WhitespaceSplit();
    case "Metaspace":
      return new Metaspace(config);
    case "ByteLevel":
      return new ByteLevel(config);
    case "Split":
      return new Split(config);
    case "Punctuation":
      return new Punctuation(config);
    case "Digits":
      return new Digits(config);
    case "Replace":
      return new Replace(config);
    case "FixedLength":
      return new FixedLength(config);
    default:
      throw new Error(`Unknown PreTokenizer type: ${config.type}`);
  }
}

export default create_pre_tokenizer;
