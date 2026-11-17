import { build } from "esbuild";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync("manifest.json", "utf8")) as { entry: string };
await build({
  entryPoints: ["src/extension.ts"],
  outfile: manifest.entry,
  bundle: true,
  format: "cjs",
  platform: "node",
  loader: { ".html": "text" },
});
