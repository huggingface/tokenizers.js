import { spawnSync } from "node:child_process";

const IMPORT = `{ Tokenizer }`;
const MODULE_NAME = "@huggingface/tokenizers";

const CODE_BODY = `
const modelId = "hf-internal-testing/tiny-random-LlamaForCausalLM";
const tokenizerJson = await fetch(\`https://huggingface.co/\${modelId}/resolve/main/tokenizer.json\`).then(res => res.json());
const tokenizerConfig = await fetch(\`https://huggingface.co/\${modelId}/resolve/main/tokenizer_config.json\`).then(res => res.json());

// Create tokenizer
const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

// Tokenize text
const tokens = tokenizer.tokenize('Hello World');
const encoded = tokenizer.encode('Hello World');
const decoded = tokenizer.decode(encoded.ids);

console.log(tokens);
console.log(encoded);
console.log(decoded);
`;

const TARGET_OUTPUT = `[ '▁Hello', '▁World' ]
{
  ids: [ 1, 15043, 2787 ],
  tokens: [ '<s>', '▁Hello', '▁World' ],
  attention_mask: [ 1, 1, 1 ]
}
<s> Hello World
`;

const wrap_async_iife = (code: string) => `(async function() { ${code} })();`;

const check = (code: string, module = false) => {
  const args = ["-e", code];
  if (module) args.push("--input-type=module");
  const { status, stdout, stderr } = spawnSync("node", args);
  expect(stderr.toString()).toEqual(""); // No warnings or errors are printed
  expect(stdout.toString()).toEqual(TARGET_OUTPUT); // The output should match
  expect(status).toEqual(0); // The process should exit cleanly
};

describe("Testing the bundle", () => {
  it("ECMAScript Module (ESM)", () => {
    check(`import ${IMPORT} from "${MODULE_NAME}";${CODE_BODY}`, true);
  });

  it("CommonJS (CJS) with require", () => {
    check(`const ${IMPORT} = require("${MODULE_NAME}");${wrap_async_iife(CODE_BODY)}`);
  });

  it("CommonJS (CJS) with dynamic import", () => {
    check(`${wrap_async_iife(`const ${IMPORT} = await import("${MODULE_NAME}");${CODE_BODY}`)}`);
  });
});
