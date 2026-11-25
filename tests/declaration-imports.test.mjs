import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteDeclarationImports } from "../scripts/rewrite-declaration-imports.mjs";

let types;
beforeEach(() => {
  types = mkdtempSync(join(tmpdir(), "tokenizers-declarations-"));
});
afterEach(() => {
  rmSync(types, { recursive: true, force: true });
});

test("rewrites relative imports and augmentations to the resolved file", () => {
  mkdirSync(join(types, "nested"));
  writeFileSync(
    join(types, "nested/index.d.ts"),
    "export interface Token {}\n",
  );
  writeFileSync(join(types, "esm.d.mts"), "export interface ESM {}\n");
  writeFileSync(join(types, "cjs.d.cts"), "export interface CJS {}\n");
  const declarations = [
    'import legacy = require("./nested");',
    'declare module "./nested" {}',
    'export type { Token } from "./nested";',
    'export type Result = import("./nested").Token;',
    'export type { ESM } from "./esm.mjs";',
    'export type { CJS } from "./cjs.cjs";',
    "export type { Token as Existing } from './nested/index.js';",
    'declare module "external-package" {}',
  ].join("\n");
  const entry = join(types, "index.d.ts");
  writeFileSync(entry, declarations);

  rewriteDeclarationImports(types);

  expect(readFileSync(entry, "utf8")).toBe(
    declarations.replaceAll('"./nested"', '"./nested/index.js"'),
  );
});

test.each(["./missing", "./missing.js"])(
  "fails the build when %s has no emitted declaration",
  (specifier) => {
    const valid = 'export type { Token } from "./token";\n';
    const earlierFile = join(types, "a.d.ts");
    writeFileSync(earlierFile, valid);
    writeFileSync(join(types, "token.d.ts"), "export interface Token {}\n");
    writeFileSync(
      join(types, "z.d.ts"),
      `import missing = require("${specifier}");\n`,
    );

    expect(() => rewriteDeclarationImports(types)).toThrow(
      `Cannot resolve ${JSON.stringify(specifier)}`,
    );
    expect(readFileSync(earlierFile, "utf8")).toBe(valid);
  },
);
