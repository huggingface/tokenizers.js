import ByteLevel from "./ByteLevel";
import WordPiece from "./WordPiece";
import Metaspace from "./Metaspace";
import BPE from "./BPE";
import CTC from "./CTC";
import Sequence from "./Sequence";
import Replace from "./Replace";
import Fuse from "./Fuse";
import Strip from "./Strip";
import ByteFallback from "./ByteFallback";

import type Decoder from "../Decoder";
import type { TokenizerConfigDecoder } from "@static/tokenizer";

function create_decoder(config: TokenizerConfigDecoder): Decoder | null {
  if (config === null) return null;

  switch (config.type) {
    case "ByteLevel":
      return new ByteLevel(config);
    case "WordPiece":
      return new WordPiece(config);
    case "Metaspace":
      return new Metaspace(config);
    case "BPEDecoder":
      return new BPE(config);
    case "CTC":
      return new CTC(config);
    case "Sequence":
      return new Sequence(config);
    case "Replace":
      return new Replace(config);
    case "Fuse":
      return new Fuse(config);
    case "Strip":
      return new Strip(config);
    case "ByteFallback":
      return new ByteFallback(config);
    default:
      throw new Error(`Unknown Decoder type: ${(config as any).type}`);
  }
}

export default create_decoder;
