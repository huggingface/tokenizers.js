import { build as esbuild } from "esbuild";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

console.log("Generating TypeScript declarations...");
execSync("tsc -p tsconfig.build.json", { stdio: "inherit" });
console.log("Resolving path aliases in declaration files...");
execSync("tsc-alias -p tsconfig.build.json", { stdio: "inherit" });

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}mb`;
};

const reportSize = (outfile) => {
  const content = readFileSync(outfile);
  const size = content.length;
  const gzipSize = gzipSync(content).length;

  console.log(
    `\n  ${outfile}  ${formatSize(size)} (gzip: ${formatSize(gzipSize)})`,
  );
  console.log(`⚡ Done\n`);
};

const build = async (outfile) => {
  const format = outfile.endsWith(".mjs") ? "esm" : "cjs";
  const minifyOptions = /\.min\.[cm]js$/.test(outfile)
    ? { minify: true, minifySyntax: true }
    : {};

  await esbuild({
    bundle: true,
    treeShaking: true,
    logLevel: "silent",
    entryPoints: ["src/index.ts"],
    platform: "neutral",
    metafile: true,
    format,
    outfile,
    ...minifyOptions,
  });
  reportSize(outfile);
};

await build("dist/tokenizers.mjs");
await build("dist/tokenizers.cjs");
await build("dist/tokenizers.min.mjs");
await build("dist/tokenizers.min.cjs");

// Read the type definition files to extract export names
const readExports = (filename) => {
  const content = readFileSync(`types/${filename}`, 'utf-8');
  const exports = [];
  const exportRegex = /export \{ default as (\w+) \}/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
};

// Generate wrapper files for submodule exports
const submodules = {
  "pre-tokenizers": readExports("pre-tokenizers.d.ts"),
  "models": readExports("models.d.ts"),
  "normalizers": readExports("normalizers.d.ts"),
  "decoders": readExports("decoders.d.ts"),
  "post-processors": readExports("post-processors.d.ts"),
};

for (const [path, exportNames] of Object.entries(submodules)) {
  const exportList = exportNames.join(", ");
  
  // ESM wrappers
  writeFileSync(
    `dist/${path}.mjs`,
    `export { ${exportList} } from './tokenizers.mjs';\n`
  );
  writeFileSync(
    `dist/${path}.min.mjs`,
    `export { ${exportList} } from './tokenizers.min.mjs';\n`
  );
  
  // CJS wrappers
  const cjsExports = exportNames.map(name => `  ${name}: main.${name}`).join(',\n');
  writeFileSync(
    `dist/${path}.cjs`,
    `const main = require('./tokenizers.cjs');\nmodule.exports = {\n${cjsExports}\n};\n`
  );
  writeFileSync(
    `dist/${path}.min.cjs`,
    `const main = require('./tokenizers.min.cjs');\nmodule.exports = {\n${cjsExports}\n};\n`
  );
}

console.log("\n✓ Generated wrapper files for submodule exports");

