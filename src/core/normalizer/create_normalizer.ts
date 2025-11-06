
import BertNormalizer from "./BertNormalizer";
import Precompiled from "./Precompiled";
import Sequence from "./Sequence";
import Replace from "./Replace";
import NFC from "./NFC";
import NFD from "./NFD";
import NFKC from "./NFKC";
import NFKD from "./NFKD";
import Strip from "./Strip";
import StripAccents from "./StripAccents";
import Lowercase from "./Lowercase";
import Prepend from "./Prepend";

import type { TokenizerConfigNormalizer } from "@static/tokenizer";
import type Normalizer from "../Normalizer";

function create_normalizer(
  config: TokenizerConfigNormalizer,
): Normalizer | null {
  if (config === null) return null;

  switch (config.type) {
    case "BertNormalizer":
      return new BertNormalizer(config);
    case "Precompiled":
      return new Precompiled(config);
    case "Sequence":
      return new Sequence(config);
    case "Replace":
      return new Replace(config);
    case "NFC":
      return new NFC(config);
    case "NFD":
      return new NFD(config);
    case "NFKC":
      return new NFKC(config);
    case "NFKD":
      return new NFKD(config);
    case "Strip":
      return new Strip(config);
    case "StripAccents":
      return new StripAccents(config);
    case "Lowercase":
      return new Lowercase(config);
    case "Prepend":
      return new Prepend(config);
    default:
      throw new Error(`Unknown Normalizer type: ${(config as any).type}`);
  }
}

export default create_normalizer;
