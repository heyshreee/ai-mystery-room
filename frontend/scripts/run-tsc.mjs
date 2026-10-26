import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// npm's generated bin shims rewrite paths to Windows paths inside WSL2,
// which breaks TypeScript's module resolution for workspace symlinks.
// Resolve and run the local compiler directly instead.
const require = createRequire(new URL("../package.json", import.meta.url));
const tscPath = require.resolve("typescript/lib/tsc.js");

await import(pathToFileURL(tscPath).href);
