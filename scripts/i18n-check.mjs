#!/usr/bin/env node
// Translation coverage check.
//   node scripts/i18n-check.mjs <dict dir> <path> [path...]
// Reports (1) t()/tn() keys with no Sinhala entry and (2) English text in JSX that isn't
// wrapped in t() yet. Exits 1 if anything is missing, so it can gate a release.
import fs from "node:fs";
import path from "node:path";

const [dictDir, ...targets] = process.argv.slice(2);
if (!dictDir || targets.length === 0) {
  console.error("usage: i18n-check.mjs <dict dir> <path> [path...]");
  process.exit(2);
}

const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const unescape = (s) => JSON.parse(`"${s}"`);

const dict = new Set();
for (const f of fs.readdirSync(dictDir)) {
  if (!/\.(ts|js)$/.test(f)) continue;
  for (const m of fs.readFileSync(path.join(dictDir, f), "utf8").matchAll(new RegExp(String.raw`^\s*${STR}\s*:`, "gm"))) dict.add(unescape(m[1]));
}

const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) fs.readdirSync(p).forEach((c) => c !== "node_modules" && walk(path.join(p, c)));
  else if (/\.tsx?$/.test(p)) files.push(p);
};
targets.forEach(walk);

// Brand and proper names that stay in English
const KEEP = new Set(["Go", "Play", "GoPlay", "GoPlay Connect", "Rs.", "AM", "PM", "EN", "PDF", "JPG", "PNG"]);

const missing = new Map();   // key -> first file
const loose = [];            // [file, line, text]
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const add = (k) => { if (!dict.has(k) && !missing.has(k)) missing.set(k, f); };
  for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*${STR}`, "g"))) add(unescape(m[1]));
  for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*${STR}\s*,\s*${STR}`, "g"))) { add(unescape(m[1])); add(unescape(m[2])); }
  // keys declared for later translation: tk("...")
  for (const m of src.matchAll(new RegExp(String.raw`\btk\(\s*${STR}`, "g"))) add(unescape(m[1]));

  if (!f.endsWith(".tsx")) continue;
  // JSX text between tags
  for (const m of src.matchAll(/>([^<>{}`]*[A-Za-z]{2,}[^<>{}`]*)</g)) {
    const txt = m[1].trim();
    if ("=-".includes(src[m.index - 1])) continue;   // arrow functions, generics
    if (/[;:]|^\W|\b(if|return|const)\b/.test(txt)) continue;   // code between two expressions
    if (!txt || KEEP.has(txt) || /^[\w.-]+$/.test(txt) && !/[a-z]{3,}/.test(txt)) continue;
    if (/=>|&&|\?\s|\)\s*;|^\s*\/\//.test(txt) || txt.includes("=")) continue;   // code, not text
    loose.push([f, lineOf(src, m.index), txt]);
  }
  // English sentences in code (ternaries, error messages, option lists) not passed through t()/tk()
  src.split("\n").forEach((raw, i) => {
    const ln = raw.replace(/\s\/\/.*$/, "");   // drop trailing comments
    if (/^\s*(\{\/\*|\/\*)/.test(ln)) return;
    if (/^\s*(import|\/\/|\*|console\.)/.test(ln) || /className=|console\.|\.(get|has)\(/.test(ln)) return;
    for (const m of ln.matchAll(/"([A-Z][^"]*?)"/g)) {
      const txt = m[1];
      if (!/[a-z]/.test(txt) || !(/\s/.test(txt) || /[.!?…]$/.test(txt)) || KEEP.has(txt)) continue;
      const before = ln.slice(0, m.index);
      if (/\b(t|tk|tn)\(\s*$|\btn\([^)]*,\s*$|\b(t|tn)\([^)]*"[^"]*",\s*$/.test(before)) continue;
      if (/(placeholder|title|aria-label|alt|label)=$/.test(before)) continue;   // reported below
      if (/^(Content-Type|Bearer )/.test(txt)) continue;
      loose.push([f, i + 1, JSON.stringify(txt)]);
    }
  });
  // user-visible string props
  for (const m of src.matchAll(/\b(placeholder|title|aria-label|alt|label)="([^"]*[A-Za-z]{2,}[^"]*)"/g)) {
    if (m[1] === "alt" && /^GoPlay$/.test(m[2])) continue;
    loose.push([f, lineOf(src, m.index), `${m[1]}="${m[2]}"`]);
  }
}

if (missing.size) {
  console.log(`\nMissing Sinhala for ${missing.size} key(s):`);
  for (const [k, f] of missing) console.log(`  ${JSON.stringify(k)}   (${f})`);
}
if (loose.length) {
  console.log(`\nUntranslated text (${loose.length}):`);
  for (const [f, l, t] of loose) console.log(`  ${f}:${l}  ${t}`);
}
console.log(`\n${files.length} files, ${dict.size} dictionary entries, ${missing.size} missing, ${loose.length} loose.`);
process.exit(missing.size || loose.length ? 1 : 0);
