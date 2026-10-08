#!/usr/bin/env node
// Copies the translation core and shared Sinhala dictionaries into the mobile apps, so web
// and apps use the same words. Edit dictionaries here (goplay-production/src/i18n), then run:
//   node scripts/sync-i18n.mjs
// Each app keeps its own extra phrases in lib/i18n/si/app.ts, which this script never touches.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src  = path.join(root, "src/i18n");
const targets = [
  { dir: path.join(root, "../goplay-app/lib/i18n"), dicts: ["common", "owner", "payments", "worker"] },
];
const banner = "// Copied from goplay-production/src/i18n by scripts/sync-i18n.mjs — edit it there.\n";

for (const t of targets) {
  if (!fs.existsSync(path.dirname(t.dir))) { console.log("skip (missing)", t.dir); continue; }
  fs.mkdirSync(path.join(t.dir, "si"), { recursive: true });
  fs.writeFileSync(path.join(t.dir, "core.ts"), banner + fs.readFileSync(path.join(src, "core.ts"), "utf8"));
  for (const d of t.dicts) fs.writeFileSync(path.join(t.dir, "si", `${d}.ts`), banner + fs.readFileSync(path.join(src, "si", `${d}.ts`), "utf8"));
  const appFile = path.join(t.dir, "si", "app.ts");
  if (!fs.existsSync(appFile)) fs.writeFileSync(appFile, "// Phrases used only in this app.\nconst d: Record<string, string> = {\n};\nexport default d;\n");
  const imports = [...t.dicts, "app"].map((d) => `import ${d === "public" ? "publicSite" : d} from "./${d}";`).join("\n");
  fs.writeFileSync(path.join(t.dir, "si", "index.ts"), banner + imports + `\n\nconst si: Record<string, string> = { ${[...t.dicts, "app"].map((d) => `...${d}`).join(", ")} };\nexport default si;\n`);
  console.log("synced", t.dir);
}
