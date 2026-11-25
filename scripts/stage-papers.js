// Resumable inventory download. Staged PDFs stay outside the deployment tree.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const out = process.argv[2];
if (!out || !path.isAbsolute(out)) throw Error("Pass an absolute staging directory");
const records = [];
let subject;
for (const line of fs.readFileSync(path.join(root, "HANDOVER.md"), "utf8").split(/\r?\n/)) {
  const heading = line.match(/^### \d+\. .*?\(`([a-z]+)` — \d+ PDFs\)/);
  if (heading) subject = heading[1];
  const row = line.match(/^\| `([^`]+)` \| `([^`]+)` \| `([\w-]+)` \| ([\d,.]+ [MK]B) \|$/);
  if (subject && row) records.push({ subject, folder: row[1], name: row[2], id: row[3] });
}
if (records.length !== 170 || new Set(records.map(r => r.id)).size !== 170) throw Error("Inventory mismatch");
fs.mkdirSync(out, {recursive:true});
let next = 0;
async function worker() {
  while (next < records.length) {
    const r = records[next++];
    const dest = path.join(out, r.id + ".pdf");
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let bytes;
        if (fs.existsSync(dest)) bytes = fs.readFileSync(dest);
        else {
          const res = await fetch("https://drive.usercontent.google.com/download?export=download&confirm=t&id=" + r.id, {signal:AbortSignal.timeout(90000)});
          if (!res.ok) throw Error("HTTP " + res.status);
          bytes = Buffer.from(await res.arrayBuffer());
        }
        if (bytes.subarray(0,5).toString() !== "%PDF-" || !bytes.subarray(-4096).includes(Buffer.from("%%EOF"))) throw Error("Not a complete PDF");
        if (!fs.existsSync(dest)) { fs.writeFileSync(dest+".tmp",bytes); fs.renameSync(dest+".tmp", dest); }
        r.bytes = bytes.length;
        r.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
        break;
      } catch (e) {if (attempt===3) r.error=e.message;}
    }
  }
}
Promise.all(Array.from({length:6},worker)).then(()=>{
  fs.writeFileSync(path.join(out,"inventory.json"),JSON.stringify(records,null,2));
  const ok=records.filter(r=>r.sha256);
  console.log(`${ok.length}/${records.length} downloaded; ${new Set(ok.map(r=>r.sha256)).size} unique hashes`);
  if(ok.length!==records.length)process.exitCode=1;
});
