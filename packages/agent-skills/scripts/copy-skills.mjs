import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "skills");
const dest = path.join(root, "dist", "skills");
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  if (name.endsWith(".yaml") || name.endsWith(".yml")) {
    fs.copyFileSync(path.join(src, name), path.join(dest, name));
  }
}
