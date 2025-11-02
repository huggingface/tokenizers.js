import { build as esbuild } from "esbuild";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

console.log("Generating TypeScript declarations...");
execSync("tsc -p tsconfig.build.json", { stdio: "inherit" });

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
}

await build("dist/tokenizers.mjs");
await build("dist/tokenizers.cjs");
await build("dist/tokenizers.min.mjs");
await build("dist/tokenizers.min.cjs");
