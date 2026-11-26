const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../taxonomy.js");

test("Fixture 1: C1101A | FIRST M.B.B.S. (CBME - 2023) Supplementary Examination, Summer - 2024 Phase - II | ANATOMY - I", () => {
  const res = T.parseHeader(
    "C1101A | FIRST M.B.B.S. (CBME - 2023) Supplementary Examination, Summer - 2024 Phase - II | ANATOMY - I"
  );
  assert.equal(res.qpCode, "C1101A");
  assert.equal(res.profYear, "FIRST");
  assert.equal(res.subject, "Anatomy");
  assert.equal(res.paperNumber, 1);
  assert.equal(res.curriculumScheme, "CBME_2023");
  assert.equal(res.curriculumBucket, "CBME");
  assert.equal(res.examSession, "SUMMER");
  assert.equal(res.examYear, 2024);
  assert.equal(res.examPhase, 2);
  assert.equal(res.attemptType, "SUPPLEMENTARY");
});

test("Fixture 2: AAB0100022201-P1 | Second M.B.B.S. (2019) Examination, (Phase - III) Winter - 2023 | PHARMACOLOGY - I", () => {
  const res = T.parseHeader(
    "AAB0100022201-P1 | Second M.B.B.S. (2019) Examination, (Phase - III) Winter - 2023 | PHARMACOLOGY - I"
  );
  assert.equal(res.qpCode, "AAB0100022201-P1");
  assert.equal(res.profYear, "SECOND");
  assert.equal(res.subject, "Pharmacology");
  assert.equal(res.paperNumber, 1);
  assert.equal(res.curriculumScheme, "CBME_2019");
  assert.equal(res.curriculumBucket, "CBME");
  assert.equal(res.examSession, "WINTER");
  assert.equal(res.examYear, 2023);
  assert.equal(res.examPhase, 3);
  assert.equal(res.attemptType, "REGULAR");
});

test("Fixture 3: AAB0100027243204 | Third M.B.B.S. (2019) (Part - 1) Examination, Winter - 2022 | FORENSIC MEDICINE & TOXICOLOGY", () => {
  const res = T.parseHeader(
    "AAB0100027243204 | Third M.B.B.S. (2019) (Part - 1) Examination, Winter - 2022 | FORENSIC MEDICINE & TOXICOLOGY"
  );
  assert.equal(res.qpCode, "AAB0100027243204");
  assert.equal(res.profYear, "THIRD_PART_1");
  assert.equal(res.subject, "Forensic Medicine & Toxicology");
  assert.equal(res.paperNumber, null);
  assert.equal(res.curriculumScheme, "CBME_2019");
  assert.equal(res.examSession, "WINTER");
  assert.equal(res.examYear, 2022);
  assert.equal(res.examPhase, null);
  assert.equal(res.attemptType, "REGULAR");
});

test("Fixture 4: c1202B | SECOND M.B.B.S. (CBME-2023) Supplementary Examination, Summer - 2025 Phase - V | PATHOLOGY - II", () => {
  const res = T.parseHeader(
    "c1202B | SECOND M.B.B.S. (CBME-2023) Supplementary Examination, Summer - 2025 Phase - V | PATHOLOGY - II"
  );
  assert.equal(res.qpCode, "C1202B");
  assert.equal(res.profYear, "SECOND");
  assert.equal(res.subject, "Pathology");
  assert.equal(res.paperNumber, 2);
  assert.equal(res.curriculumScheme, "CBME_2023");
  assert.equal(res.examSession, "SUMMER");
  assert.equal(res.examYear, 2025);
  assert.equal(res.examPhase, 5);
  assert.equal(res.attemptType, "SUPPLEMENTARY");
});

test("Fixture 5: 01201A | Second M.B.B.S. (OLD) Examination, Summer - 2024 | PHARMACOLOGY - I", () => {
  const res = T.parseHeader(
    "01201A | Second M.B.B.S. (OLD) Examination, Summer - 2024 | PHARMACOLOGY - I"
  );
  assert.equal(res.qpCode, "01201A");
  assert.equal(res.profYear, "SECOND");
  assert.equal(res.subject, "Pharmacology");
  assert.equal(res.paperNumber, 1);
  assert.equal(res.curriculumScheme, "OLD");
  assert.equal(res.curriculumBucket, "OLD");
  assert.equal(res.examSession, "SUMMER");
  assert.equal(res.examYear, 2024);
  assert.equal(res.examPhase, null);
  assert.equal(res.attemptType, "REGULAR");
});

test("OCR sanitization: leading O in O1201A, Phase - 11, footer boilerplate ignored", () => {
  const res = T.parseHeader(
    "O1201A\nSecond M.B.B.S. (OLD) Examination, Summer — 2024 Phase - 11\nPHARMACOLOGY - I\nSection A+B+C\nTotal No. of Pages : 2"
  );
  assert.equal(res.qpCode, "01201A");
  assert.equal(res.examPhase, 2);
  assert.equal(res.curriculumScheme, "OLD");
  assert.equal(res.paperNumber, 1);
});

test("QP code 0111[1-3][AB] exception: (2019) tag overrides OLD", () => {
  const res = T.parseHeader(
    "01111A | First M.B.B.S. (2019) Examination, Winter - 2020 | ANATOMY - I"
  );
  assert.equal(res.curriculumScheme, "CBME_2019");
  assert.equal(res.curriculumBucket, "CBME");
  assert.equal(res.profYear, "FIRST");
});

test("Subject year shifts: FMT, ENT, Ophthalmology", () => {
  const fmtOld = T.parseHeader("01204 | Second M.B.B.S. (OLD) Examination, Summer - 2023 | FORENSIC MEDICINE & TOXICOLOGY");
  assert.equal(fmtOld.profYear, "SECOND");

  const ent2019 = T.parseHeader("AAB010003101 | Third M.B.B.S. (2019) (Part - I) Examination, Winter - 2023 | OTORHINOLARYNGOLOGY (E.N.T.)");
  assert.equal(ent2019.profYear, "THIRD_PART_1");

  const ent2021 = T.parseHeader("AAB010003101 | Third M.B.B.S. (2021) (Part - II) Examination, Winter - 2024 | ENT");
  assert.equal(ent2021.curriculumScheme, "CBME_2021_SPLIT");
  assert.equal(ent2021.profYear, "THIRD_PART_2");
});

test("August 2026 Unified CBME Common Paper policy", () => {
  const winter2026 = T.parseHeader("C1201A | SECOND M.B.B.S. (CBME) Examination, Winter - 2026 | PATHOLOGY - I");
  assert.equal(winter2026.curriculumScheme, "CBME_UNIFIED_2026");

  const old2026 = T.parseHeader("01201A | Second M.B.B.S. (OLD) Examination, Winter - 2026 | PHARMACOLOGY - I");
  assert.equal(old2026.curriculumScheme, "OLD");
});

test("Deduplication preserves distinct schemes, attempts, and phases, and handles missing phase fallback", () => {
  const items = [
    { profYear: "SECOND", subject: "Pathology", paperNumber: 1, curriculumScheme: "OLD", examYear: 2022, examSession: "WINTER", attemptType: "REGULAR", examPhase: null },
    { profYear: "SECOND", subject: "Pathology", paperNumber: 1, curriculumScheme: "CBME_2019", examYear: 2022, examSession: "WINTER", attemptType: "REGULAR", examPhase: 3 },
    { profYear: "SECOND", subject: "Pathology", paperNumber: 1, curriculumScheme: "CBME_2019", examYear: 2022, examSession: "WINTER", attemptType: "REGULAR", examPhase: null },
    { profYear: "SECOND", subject: "Pathology", paperNumber: 1, curriculumScheme: "CBME_2019", examYear: 2022, examSession: "WINTER", attemptType: "SUPPLEMENTARY", examPhase: 4 },
  ];
  const deduped = T.deduplicatePapers(items);
  assert.equal(deduped.length, 3);
});

test("Chronological sort key orders Year -> Winter/Summer -> Suppl/Regular -> Phase", () => {
  const s24RegP1 = T.chronologicalSortKey({ examYear: 2024, examSession: "SUMMER", attemptType: "REGULAR", examPhase: 1 });
  const s24SupP2 = T.chronologicalSortKey({ examYear: 2024, examSession: "SUMMER", attemptType: "SUPPLEMENTARY", examPhase: 2 });
  const w24RegP3 = T.chronologicalSortKey({ examYear: 2024, examSession: "WINTER", attemptType: "REGULAR", examPhase: 3 });
  assert.ok(w24RegP3 > s24SupP2 && s24SupP2 > s24RegP1);
});

test("Real OCR patterns: Summer (Phase - II) 2019, CBME (2024), Faculty prefix Medicine Paediatrics", () => {
  const col = T.parseHeader("01101A | First M.B.B.S. Examination, Summer (Phase - II) 2019 | ANATOMY - I");
  assert.equal(col.examSession, "SUMMER");
  assert.equal(col.examYear, 2019);
  assert.equal(col.examPhase, 2);

  const ped = T.parseHeader("AAB0100027244205 | Medicine Paediatrics Final MBBS NA Section A | Paediatrics");
  assert.equal(ped.subject, "Paediatrics");
  assert.equal(ped.profYear, "THIRD_PART_2");

  const biochem24 = T.parseHeader("C1113A | Medicine_Biochemistry-I_First MBBS CBME (2024)_Paper-I_Section B");
  assert.equal(biochem24.curriculumScheme, "CBME_2024");
  assert.equal(biochem24.paperNumber, 1);

  const xax = T.parseHeader("ANATOMY - I\nTotal Duration : Section A + B = 3 Hours\nTotal No. of Pages : 2\nFirst MBBS (2019) Examination, (Phase -Jit) Winter - 2021");
  assert.equal(xax.curriculumScheme, "CBME_2019");
  assert.equal(xax.examSession, "WINTER");
  assert.equal(xax.examYear, 2021);
  assert.equal(xax.examPhase, 3);

  const supplOcr = T.parseHeader("C1102A\nFirst M.B.B.S. (CBME-2023)SuppIementary Examination, (Phase - [V) Summer - 2024\nPHYSIOLOGY - I");
  assert.equal(supplOcr.attemptType, "SUPPLEMENTARY");
  assert.equal(supplOcr.examPhase, 4);
  assert.equal(supplOcr.examSession, "SUMMER");
  assert.equal(supplOcr.examYear, 2024);

  const commMarks = T.parseHeader("AAB0100027243201-P2 | THIRD M.B.B.S. (2019) (Part-I) | Community Medicine-II | Define Accident (2)");
  assert.equal(commMarks.profYear, "THIRD_PART_1");
  assert.equal(commMarks.curriculumScheme, "CBME_2019");
});

test("Integration: taxonomy.parseHeader resolves OCR codes & sequential ERP codes via subject-codes registry", () => {
  const ct202 = T.parseHeader("ct202B | SECOND M.B.B.S. Summer - 2025 | PATHOLOGY");
  assert.equal(ct202.qpCode, "C1202B");
  assert.equal(ct202.qpSource, "registry");
  assert.equal(ct202.subjectId, "pathology");
  assert.equal(ct202.paperNumber, 2);

  const surg1 = T.parseHeader("AAB0100027244206 | Final M.B.B.S. (2019) Winter - 2023 | GENERAL SURGERY");
  assert.equal(surg1.qpSource, "registry");
  assert.equal(surg1.subjectId, "surgery");
  assert.equal(surg1.paperNumber, 1);

  const ophthalSplit = T.parseHeader("AAB0100027243202 | Third M.B.B.S. (2021) (Part - II) Winter - 2024 | OPHTHALMOLOGY");
  assert.equal(ophthalSplit.profYear, "THIRD_PART_2");
  assert.equal(ophthalSplit.curriculumScheme, "CBME_2021_SPLIT");

  const fallbackC = T.parseHeader("C1211A | Second M.B.B.S. (CBME-2024) Summer - 2025");
  assert.equal(fallbackC.qpSource, "regex_fallback");
  assert.equal(fallbackC.qpRequiresReview, true);
  assert.equal(fallbackC.profYear, "SECOND");
  assert.equal(fallbackC.subjectId, "pharmacology");
});

const S = require("../pdf-scanner.js");

test("detectPaperSection ignores duration A+B and identifies MCQ vs THEORY vs COMBINED", () => {
  assert.equal(
    S.detectPaperSection("Second M.B.B.S. Winter - 2023\nPATHOLOGY - I\nTotal Duration : Section A+B = 3 Hours\nSection B Marks : 80"),
    "THEORY"
  );
  assert.equal(
    S.detectPaperSection('First M.B.B.S. Summer - 2024\nANATOMY - I\nSECTION "A" MCQ\nTotal Marks : 20'),
    "MCQ"
  );
  assert.equal(
    S.detectPaperSection('First M.B.B.S. Summer - 2024\nANATOMY - I\nSECTION "A" MCQ\nSECTION "B" SAQ & LAQ'),
    "COMBINED"
  );
});

test("findDuplicatePaper rejects exact SHA-256 and overlapping taxonomy, allows complementary MCQ+THEORY", () => {
  const existing = [
    {
      id: "db-1",
      profYear: "SECOND",
      subject: "Pathology",
      subjectId: "pathology",
      paperNumber: 1,
      curriculumScheme: "CBME_2019",
      examYear: 2023,
      examSession: "WINTER",
      attemptType: "REGULAR",
      examPhase: 3,
      paperSection: "THEORY",
      fileSha256: "abc123",
    },
    {
      id: "db-2",
      profYear: "FIRST",
      subject: "Anatomy",
      subjectId: "anatomy",
      paperNumber: 1,
      curriculumScheme: "CBME_2023",
      examYear: 2024,
      examSession: "SUMMER",
      attemptType: "REGULAR",
      examPhase: 2,
      paperSection: "COMBINED",
    },
  ];

  // Exact file SHA match rejected regardless of metadata
  const shaDup = S.findDuplicatePaper({ subjectId: "biochemistry", fileSha256: "abc123" }, existing);
  assert.equal(shaDup?.reason, "exact-file");

  // Exact same THEORY half rejected
  const sameTheory = S.findDuplicatePaper(
    {
      profYear: "SECOND",
      subject: "Pathology",
      subjectId: "pathology",
      paperNumber: 1,
      curriculumScheme: "CBME_2019",
      examYear: 2023,
      examSession: "WINTER",
      attemptType: "REGULAR",
      examPhase: 3,
      paperSection: "THEORY",
    },
    existing
  );
  assert.equal(sameTheory?.reason, "taxonomy");

  // Complementary MCQ half allowed alongside THEORY-only record
  const complementaryMcq = S.findDuplicatePaper(
    {
      profYear: "SECOND",
      subject: "Pathology",
      subjectId: "pathology",
      paperNumber: 1,
      curriculumScheme: "CBME_2019",
      examYear: 2023,
      examSession: "WINTER",
      attemptType: "REGULAR",
      examPhase: 3,
      paperSection: "MCQ",
    },
    existing
  );
  assert.equal(complementaryMcq, null);

  // Already have COMBINED Anatomy paper -> reject uploading another copy
  const combinedDup = S.findDuplicatePaper(
    {
      profYear: "FIRST",
      subject: "Anatomy",
      subjectId: "anatomy",
      paperNumber: 1,
      curriculumScheme: "CBME_2023",
      examYear: 2024,
      examSession: "SUMMER",
      attemptType: "REGULAR",
      examPhase: 2,
      paperSection: "COMBINED",
    },
    existing
  );
  assert.equal(combinedDup?.reason, "taxonomy");
});
