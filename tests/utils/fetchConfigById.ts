import { TokenizerJSON, TokenizerConfig } from "../../src/static/tokenizer";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fetchConfigById = async (
  modelId: string,
): Promise<{
  tokenizerJson: TokenizerJSON;
  tokenizerConfig: TokenizerConfig;
}> => {
  const cacheId = modelId;

  const cacheDir = path.join(__dirname, "..", "data", "tokenizers", cacheId);
  const tokenizerJsonPath = path.join(cacheDir, "tokenizer.json");
  const tokenizerConfigPath = path.join(cacheDir, "tokenizer_config.json");

  if (fs.existsSync(tokenizerJsonPath) && fs.existsSync(tokenizerConfigPath)) {
    try {
      const tokenizerJson = JSON.parse(fs.readFileSync(tokenizerJsonPath, "utf-8"));
      const tokenizerConfig = JSON.parse(fs.readFileSync(tokenizerConfigPath, "utf-8"));
      return { tokenizerJson, tokenizerConfig };
    } catch {
      fs.rmSync(cacheDir, { force: true, recursive: true });
    }
  }

  const remoteUrl = `https://huggingface.co/${modelId}/resolve/main/tokenizer.json`;
  const remoteUrlConfig = `https://huggingface.co/${modelId}/resolve/main/tokenizer_config.json`;

  const loadJson = async (url: string) => {
    const response = await fetch(url);
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON from ${url} : ${response.status} ${response.statusText} (${contentType}). Body starts with: ${text.slice(0, 120)}`);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(`Failed to parse JSON from ${url} : ${response.status} ${response.statusText} (${contentType}). ${error instanceof Error ? error.message : String(error)}. Body starts with: ${text.slice(0, 120)}`);
    }
  };

  const [tokenizerJson, tokenizerConfig] = await Promise.all([loadJson(remoteUrl), loadJson(remoteUrlConfig)]);

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(tokenizerJsonPath, JSON.stringify(tokenizerJson));
  fs.writeFileSync(tokenizerConfigPath, JSON.stringify(tokenizerConfig));

  return { tokenizerJson, tokenizerConfig };
};

export default fetchConfigById;
