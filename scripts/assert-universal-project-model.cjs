const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = ["src", "scripts", "supabase/tests", "README.md", "PRODUCT.md", "next.config.ts"];
const FORBIDDEN = [
  /\bProjectTrack\b/g,
  /\bproject_track\b/g,
  /\bprojectTrack\b/g,
  /\btrack_payload_json\b/g,
  /\bmvp_scope\b/g,
  /\bmvpScope\b/g,
  /\brepo_structure\b/g,
  /\breadme_draft\b/g,
  /\?track=/g,
  /\bsoftware track\b/gi,
  /\bresearch track\b/gi,
  /\b(?:two|2) tracks\b/gi,
  /\bboth tracks\b/gi,
  /\bresearch[- ]lens\b/gi,
  /\b(?:Software|Research) anchors:/g,
  /\btitle, track, or summary\b/gi,
];

function filesAt(target) {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [absolute];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", ".next", ".git"].includes(entry.name)) return [];
    return filesAt(path.relative(ROOT, path.join(absolute, entry.name)));
  });
}

const findings = [];
for (const file of TARGETS.flatMap(filesAt)) {
  if (file === __filename) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of FORBIDDEN) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push(`${path.relative(ROOT, file)}:${line}: ${match[0]}`);
    }
  }
}

if (findings.length) {
  console.error("Legacy two-track concepts remain:\n" + findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Universal project model assertion passed.");
}
