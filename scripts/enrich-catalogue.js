const fs = require("node:fs");
const path = require("node:path");
const T = require("../taxonomy.js");

const ROOT = path.resolve(__dirname, "..");
const OCR_DIR = "C:\\Users\\kdkad\\.gemini\\antigravity\\brain\\021d81b1-374c-4081-9b8c-b641d088d121\\scratch\\ocr_cache";
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

global.window = {};
require(path.join(ROOT, "data.js"));
require(path.join(ROOT, "hosted-papers.js"));

const origHosted = global.window.MUHS_DATA.hostedPapers;
const existingReplacedIds = global.window.MUHS_DATA.replacedPaperIds || {};

// Known end-page spans observed across the 14 OLD multi-year collection PDFs
const COLLECTION_SPANS = {
  "collection-RjvEi7T-1.pdf": "2015–2019",
  "collection-f1G4EDo-1.pdf": "2015–2019",
  "collection-vYPwzto-1.pdf": "2015–2019",
  "collection-BYEqLb2-1.pdf": "2015–2019",
  "collection-tMfK0uK-1.pdf": "2015–2019",
  "collection-biHD-zV-1.pdf": "2015–2019",
  "collection-lr31j6W-1.pdf": "2015–2019",
  "collection-ioPTy9I-1.pdf": "2015–2019",
  "collection-gJMiRLE-1.pdf": "2016–2019",
  "collection-f_dXwmb-1.pdf": "2015–2019",
  "collection-zs5SEh2-1.pdf": "2015–2019",
  "collection-wVAe1fw-1.pdf": "2015–2019",
  "collection-XZNn3wF-1.pdf": "2015–2019",
  "collection-IZcytSx-1.pdf": "2015–2019",
};

// Explicit forensic overrides ONLY where PDF scan edge physically clipped the final digit
// (all other fields come straight from PDF OCR via T.parseHeader)
const CLIPPED_SCAN_OVERRIDES = {
  // ENT undated-3Hwb2xS-1.pdf: printed `Third Year M.B.B.S. (Part-I) (Old) (Phase - III) | N-16 | Winter-2 il`
  gdrive_1FUj3iAhclbgzM0TURLk2ZXgSr3Hwb2xS: { examSession: "WINTER", examYear: 2021, examPhase: 3 },
  // Pathology winter-2022-paper-2-vfbXiko-7.pdf: printed `Second M.B.B.S. (Old) Examination, Winter -202` (companion to Paper 1 vfbXiko-5)
  gdrive_1D6xR_mrPa2uxGAJtLVO7owpumvfbXiko_p7: { examSession: "WINTER", examYear: 2022 },
  // Surgery undated-paper-2-eHCFfSt-1.pdf vs winter-2023-paper-2: model/specimen portal scan (no session printed in header)
};

function questionTokens(ocr) {
  const txt = ocr.pages
    .map((p) => p.lines.join(" "))
    .join(" ")
    .toLowerCase()
    .replace(/do not write anything[\s\S]{0,350}?distribution[\s\S]{0,250}?done\.?/gi, " ")
    .replace(/[^a-z0-9]+/g, " ");
  return new Set(txt.split(/\s+/).filter((w) => w.length >= 5));
}

function containment(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.max(1, Math.min(a.size, b.size));
}

function buildTitle(rec) {
  const partStr = rec.paperNumber === 1 ? "Paper I" : rec.paperNumber === 2 ? "Paper II" : "";
  const bits = [rec.subject];
  if (partStr) bits.push(partStr);
  if (rec.isCompilation) {
    const kind = rec.paperSection === "MCQ" ? "MCQ Compilation" : rec.paperSection === "THEORY" ? "Theory Compilation" : "Question Paper Compilation";
    bits.push(kind + (rec.compilationSpan ? " (" + rec.compilationSpan + ")" : ""));
  } else if (rec.attemptType === "MODEL") {
    bits.push(T.formatSchemeBadge(rec.curriculumScheme) + " Model Paper");
  } else {
    const sess = T.formatSessionLabel(rec.examSession) + " " + rec.examYear;
    const extras = [];
    if (rec.attemptType === "SUPPLEMENTARY") extras.push("Supplementary");
    if (rec.paperSection === "MCQ") extras.push("MCQ Section A");
    else if (rec.paperSection === "THEORY") extras.push("Theory");
    bits.push(sess + (extras.length ? " — " + extras.join(" · ") : ""));
  }
  return bits.join(" — ");
}

const enriched = origHosted.map((item) => {
  const ocrPath = path.join(OCR_DIR, item.id + ".json");
  const ocr = readJson(ocrPath);
  const hdrLines = ocr.pages.map((p) => p.lines.slice(0, 22).join("\n")).join("\n");
  const fullText = ocr.pages.map((p) => p.lines.join("\n")).join("\n");
  const parsed = T.parseHeader(hdrLines, { subjectIdHint: item.subjectId });
  const ov = CLIPPED_SCAN_OVERRIDES[item.id] || {};
  const examSession = ov.examSession || parsed.examSession;
  const examYear = ov.examYear || parsed.examYear;
  const examPhase = ov.examPhase !== undefined ? ov.examPhase : parsed.examPhase;

  const bodyForSections = T.stripFooterBoilerplate(fullText);
  const hasSecA = /\bSection\s*[-–—]?\s*["']?A["']?\b|\bMultiple\s+Choice\b|\bMCQ\b/i.test(bodyForSections);
  const hasSecBC = /\bSection\s*[-–—]?\s*["']?[BC]["']?\b|\bLong\s+Answer\b|\bShort\s+Answer\b/i.test(bodyForSections);
  let paperSection = "COMBINED";
  if (hasSecA && !hasSecBC) paperSection = "MCQ";
  else if (!hasSecA && hasSecBC) paperSection = "THEORY";
  else if (/^MCQ\b/i.test(item.title || "")) paperSection = "MCQ";
  else if (/^Theory\b/i.test(item.title || "")) paperSection = "THEORY";

  const isCompilation = item.catalogueGroup === "Multi-year collection" || Boolean(item.isCompilation);
  let curriculumScheme = parsed.curriculumScheme;
  let profYear = parsed.profYear;
  if (isCompilation) {
    curriculumScheme = "OLD";
    const subDef = T.SUBJECT_BY_ID.get(parsed.subjectId || item.subjectId);
    profYear = T.applySubjectYearShift(subDef, profYear, "OLD");
  }
  if (!curriculumScheme) {
    // Remaining papers without explicit header tag: default by subject/QP era (OLD if 01xxx or 2020 w/o 2019 tag, else CBME_2019)
    curriculumScheme = Number(examYear) <= 2020 ? "OLD" : "CBME_2019";
    const subDef = T.SUBJECT_BY_ID.get(parsed.subjectId || item.subjectId);
    profYear = T.applySubjectYearShift(subDef, profYear, curriculumScheme);
  }
  const curriculumBucket = curriculumScheme === "OLD" ? "OLD" : "CBME";

  const isModel = !isCompilation && (!examYear || !examSession);
  const attemptType = isCompilation ? "COMPILATION" : isModel ? "MODEL" : parsed.attemptType;

  // Compilation spans from PDF headers/existing verified ranges
  let compilationSpan = null;
  if (isCompilation) {
    const fn = path.basename(item.url);
    if (COLLECTION_SPANS[fn]) compilationSpan = COLLECTION_SPANS[fn];
    else {
      const m = (item.title || "").match(/\((\d{4}[–-]\d{4})/);
      if (m) compilationSpan = m[1].replace("-", "–");
      else compilationSpan = "2002–2015";
    }
  }

  let modelSchemeYear = null;
  if (isModel) {
    modelSchemeYear =
      curriculumScheme === "CBME_2024" ? 2024 :
      curriculumScheme === "CBME_2023" ? 2023 :
      curriculumScheme === "CBME_2021_SPLIT" ? 2021 : 2019;
  }

  // Raw header excerpt (first 8 lines of page 1 + Section B header line if present)
  const p1Header = (ocr.pages[0]?.lines || []).slice(0, 8).join(" | ");
  const rawHeaderText = p1Header.slice(0, 320);

  const rec = {
    id: item.id,
    qpCode: parsed.qpCode,
    profYear,
    subjectId: parsed.subjectId || item.subjectId,
    subject: parsed.subject || T.SUBJECT_BY_ID.get(item.subjectId)?.name || item.subjectId,
    paperNumber: parsed.paperNumber,
    curriculumScheme,
    curriculumBucket,
    examSession,
    examYear,
    examPhase,
    attemptType,
    paperSection,
    actualExamDate: null,
    inferredCohortHint: null,
    rawHeaderText,
    isCompilation,
    compilationSpan,
    modelSchemeYear,
    // Keep compatibility fields
    session: examSession ? T.formatSessionLabel(examSession) : null,
    year: examYear || null,
    kind: "site",
    fileType: "application/pdf",
    fileSize: item.fileSize,
    fileName: item.fileName || path.basename(item.url),
    url: item.url,
    addedAt: item.addedAt,
    pages: ocr.pageCount,
    _tokens: questionTokens(ocr),
  };
  rec.title = buildTitle(rec);
  return rec;
});

// Deduplicate verified redundant / partial duplicates (>90% content containment within same canonical bucket)
const survivors = [];
const replacedIds = { ...existingReplacedIds };

// Sort candidates so richer/complete/canonical files win first:
// Prefer higher page count (full packet over 2p excerpt), non-legacy URL over legacy duplicate URL, Section A+B over Section A only
enriched.sort((a, b) => {
  const aLegacy = /\/legacy-/.test(a.url) ? 1 : 0;
  const bLegacy = /\/legacy-/.test(b.url) ? 1 : 0;
  if (b.pages !== a.pages) return b.pages - a.pages;
  if (aLegacy !== bLegacy) return aLegacy - bLegacy;
  return b.fileSize - a.fileSize;
});

for (const cand of enriched) {
  let dupOf = null;
  if (!cand.isCompilation) {
    for (const kept of survivors) {
      if (kept.isCompilation) continue;
      if (kept.subjectId !== cand.subjectId) continue;
      if (kept.curriculumScheme !== cand.curriculumScheme) continue;
      if (kept.paperNumber !== cand.paperNumber) continue;
      if ((kept.examYear || "M") !== (cand.examYear || "M")) continue;
      if ((kept.examSession || "M") !== (cand.examSession || "M")) continue;
      if (kept.attemptType !== cand.attemptType) continue;
      if (kept.examPhase != null && cand.examPhase != null && kept.examPhase !== cand.examPhase) continue;
      const sim = containment(cand._tokens, kept._tokens);
      if (sim >= 0.9) {
        dupOf = kept;
        break;
      }
    }
  }
  if (dupOf) {
    replacedIds[cand.id] = dupOf.id;
  } else {
    survivors.push(cand);
  }
}

// Re-sort survivors canonically for deterministic output
survivors.sort((a, b) => a.subjectId.localeCompare(b.subjectId) || T.comparePapersRecency(a, b));

console.log("Original:", enriched.length, "Survivors:", survivors.length, "Deduplicated:", Object.keys(replacedIds).length);
console.log("Attempt types:", survivors.reduce((m, r) => ((m[r.attemptType] = (m[r.attemptType] || 0) + 1), m), {}));
console.log("Curriculum schemes:", survivors.reduce((m, r) => ((m[r.curriculumScheme] = (m[r.curriculumScheme] || 0) + 1), m), {}));
console.log("Prof years:", survivors.reduce((m, r) => ((m[r.profYear] = (m[r.profYear] || 0) + 1), m), {}));
console.log("Undated non-model remaining:", survivors.filter((r) => !r.isCompilation && r.attemptType !== "MODEL" && (!r.examYear || !r.examSession)).length);
console.log("\nModel papers (" + survivors.filter((r) => r.attemptType === "MODEL").length + "):");
survivors.filter((r) => r.attemptType === "MODEL").forEach((r) => console.log(" ", r.subjectId, "|", r.qpCode, "|", r.curriculumScheme, "|", r.title));
console.log("\nDeduplicated replacements (" + Object.keys(replacedIds).length + "):");
for (const [oldId, newId] of Object.entries(replacedIds)) {
  const o = enriched.find((x) => x.id === oldId);
  const n = survivors.find((x) => x.id === newId);
  if (o && n) console.log(" ", o.url, "->", n.url);
  else console.log(" ", oldId, "->", newId);
}

// Check if --write flag passed to update hosted-papers.js (keep PDF files intact unless --prune-pdfs)
if (process.argv.includes("--write")) {
  const out = survivors.map(({ _tokens, pages, ...clean }) => clean);
  const content =
    "// Generated from PDF OCR content & MUHS taxonomy rules (.agents/rules/muhs-paper-taxonomy.md).\n" +
    "// Never edit metadata by filename; regenerate via scripts/enrich-catalogue.js.\n" +
    "window.MUHS_DATA.replacedPaperIds = " + JSON.stringify(replacedIds, null, 2) + ";\n" +
    "window.MUHS_DATA.hostedPapers = " + JSON.stringify(out, null, 2) + ";\n";
  fs.writeFileSync(path.join(ROOT, "hosted-papers.js"), content, "utf8");
  console.log("\nWrote hosted-papers.js with", out.length, "entries and", Object.keys(replacedIds).length, "replacedPaperIds.");

  if (process.argv.includes("--prune-dups")) {
    const keepUrls = new Set(out.map((r) => r.url));
    let removed = 0;
    for (const oldId of Object.keys(replacedIds)) {
      const oldEntry = enriched.find((x) => x.id === oldId);
      if (oldEntry && !keepUrls.has(oldEntry.url)) {
        const full = path.join(ROOT, oldEntry.url);
        if (fs.existsSync(full)) {
          fs.unlinkSync(full);
          removed++;
        }
      }
    }
    console.log("Pruned duplicate PDFs from papers/:", removed);
  }
}
