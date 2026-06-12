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
    const tokenizerJson = JSON.parse(fs.readFileSync(tokenizerJsonPath, "utf-8"));
    const tokenizerConfig = JSON.parse(fs.readFileSync(tokenizerConfigPath, "utf-8"));
    return { tokenizerJson, tokenizerConfig };
  }

  const remoteUrl = `https://huggingface.co/${modelId}/resolve/main/tokenizer.json`;
  const remoteUrlConfig = `https://huggingface.co/${modelId}/resolve/main/tokenizer_config.json`;

  const headers: Record<string, string> = { "User-Agent": "tokenizers.js-tests/1.0" };
  if (process.env.HF_TOKEN) headers["Authorization"] = `Bearer ${process.env.HF_TOKEN}`;

  const loadJson = async (url: string) => {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch ${url} (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }
    return await response.json();
  };

  const [tokenizerJson, tokenizerConfig] = await Promise.all([loadJson(remoteUrl), loadJson(remoteUrlConfig)]);

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(tokenizerJsonPath, JSON.stringify(tokenizerJson));
  fs.writeFileSync(tokenizerConfigPath, JSON.stringify(tokenizerConfig));

  return { tokenizerJson, tokenizerConfig };
};

export default fetchConfigById;
