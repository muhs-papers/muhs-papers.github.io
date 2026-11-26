const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");

const FILES = [
  "index.html",
  "styles.css",
  "data.js",
  "hosted-papers.js",
  "muhs-subject-codes.json",
  "subject-codes.js",
  "taxonomy.js",
  "pdf-scanner.js",
  "app.js",
  "manifest.json",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "subject-icons.svg",
  "upi-qr.jpg",
  "sw.js",
];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(ROOT, file), path.join(WWW, file));
}

fs.cpSync(path.join(ROOT, "fonts"), path.join(WWW, "fonts"), { recursive: true });
fs.cpSync(path.join(ROOT, "vendor"), path.join(WWW, "vendor"), { recursive: true });
console.log("Prepared www/ with", FILES.length, "files + fonts/ + vendor/");
