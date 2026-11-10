import { build as esbuild } from "esbuild";
import ts from "typescript";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

console.log("Generating TypeScript declarations...");
execSync("tsc -p tsconfig.build.json", { stdio: "inherit" });
console.log("Resolving path aliases in declaration files...");
execSync("tsc-alias -p tsconfig.build.json", { stdio: "inherit" });

// NodeNext consumers need explicit extensions even in declaration files.
// Resolve against the emitted declarations since the JS is bundled separately.
const resolverOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler };
for (const declaration of ts.sys.readDirectory("types", [".d.ts"])) {
  const source = ts.createSourceFile(
    declaration,
    readFileSync(declaration, "utf8"),
    ts.ScriptTarget.Latest,
  );
  const specifiers = [];
  function collectSpecifiers(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifiers.push(node.moduleSpecifier);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      specifiers.push(node.argument.literal);
    }
    ts.forEachChild(node, collectSpecifiers);
  }
  collectSpecifiers(source);

  let output = source.text;
  for (const specifier of specifiers.reverse()) {
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    const fileName = specifier.text;
    if (!fileName.startsWith(".") || fileName.endsWith(".js")) continue;
    const { resolvedModule } = ts.resolveModuleName(
      fileName,
      declaration,
      resolverOptions,
      ts.sys,
    );
    if (resolvedModule?.extension !== ts.Extension.Dts) continue;
    const path = relative(dirname(declaration), resolvedModule.resolvedFileName)
      .replaceAll(sep, "/")
      .replace(/\.d\.ts$/, ".js");
    const importPath = path.startsWith("../") ? path : "./" + path;
    output =
      output.slice(0, specifier.getStart(source)) +
      JSON.stringify(importPath) +
      output.slice(specifier.end);
  }
  if (output !== source.text) writeFileSync(declaration, output);
}

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
