import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";

const resolverOptions = { moduleResolution: ts.ModuleResolutionKind.Bundler };
const runtimeExtensions = new Map([
  [ts.Extension.Dts, ".js"],
  [ts.Extension.Dmts, ".mjs"],
  [ts.Extension.Dcts, ".cjs"],
]);

export function rewriteDeclarationImports(directory) {
  const files = ts.sys.readDirectory(directory, [...runtimeExtensions.keys()]);
  const emittedFiles = new Set(files.map((file) => resolve(file)));
  const updates = [];

  for (const declaration of files) {
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
      } else if (ts.isExternalModuleReference(node)) {
        specifiers.push(node.expression);
      } else if (ts.isModuleDeclaration(node)) {
        specifiers.push(node.name);
      }
      ts.forEachChild(node, collectSpecifiers);
    }
    collectSpecifiers(source);

    // NodeNext consumers need explicit paths. Resolve them against the emitted
    // declarations since the JavaScript is bundled separately.
    let output = source.text;
    for (const specifier of specifiers.reverse()) {
      if (!specifier || !ts.isStringLiteralLike(specifier)) continue;
      const fileName = specifier.text;
      if (!/^\.\.?(?:[\\/]|$)/.test(fileName)) continue;
      const { resolvedModule } = ts.resolveModuleName(
        fileName,
        declaration,
        resolverOptions,
        ts.sys,
      );
      const extension = runtimeExtensions.get(resolvedModule?.extension);
      if (
        !extension ||
        !emittedFiles.has(resolve(resolvedModule.resolvedFileName))
      ) {
        throw new Error(
          `Cannot resolve ${JSON.stringify(fileName)} from ${declaration} to an emitted declaration`,
        );
      }
      const relativeFile = relative(
        dirname(declaration),
        resolvedModule.resolvedFileName,
      ).replaceAll(sep, "/");
      const runtimeFile =
        relativeFile.slice(0, -resolvedModule.extension.length) + extension;
      const importPath = runtimeFile.startsWith("../")
        ? runtimeFile
        : "./" + runtimeFile;
      if (importPath === fileName) continue;
      output =
        output.slice(0, specifier.getStart(source)) +
        JSON.stringify(importPath) +
        output.slice(specifier.end);
    }
    if (output !== source.text) updates.push([declaration, output]);
  }

  for (const [declaration, output] of updates) {
    writeFileSync(declaration, output);
  }
}
