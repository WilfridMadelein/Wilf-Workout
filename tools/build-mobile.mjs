import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(toolsDir, "..");
const outputDir = resolve(rootDir, "www");
const runtimeEntries = ["index.html", "css", "data", "html", "js", "assets"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const entry of runtimeEntries) {
    const source = resolve(rootDir, entry);
    if (!existsSync(source)) continue;
    await cp(source, resolve(outputDir, entry), { recursive: true });
}

console.log("Build mobile créé dans www/.");