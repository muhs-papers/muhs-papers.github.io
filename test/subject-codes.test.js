const test = require("node:test");
const assert = require("node:assert/strict");
const SC = require("../subject-codes.js");

test("Exact lookup covers First, Second, Third Pt I, Third Pt II, and inferred C1203A", () => {
  const c1101a = SC.lookupQpCode("C1101A");
  assert.equal(c1101a.source, "registry");
  assert.equal(c1101a.subject, "Anatomy");
  assert.equal(c1101a.subjectId, "anatomy");
  assert.equal(c1101a.paperNumber, 1);
  assert.equal(c1101a.profYear, "FIRST");
  assert.equal(c1101a.curriculumScheme, "CBME_2023");

  const c1113a = SC.lookupQpCode("C1113A");
  assert.equal(c1113a.source, "registry");
  assert.equal(c1113a.subject, "Biochemistry");
  assert.equal(c1113a.paperNumber, 1);
  assert.equal(c1113a.profYear, "FIRST");
  assert.equal(c1113a.curriculumScheme, "CBME_2024");

  const early2019 = SC.lookupQpCode("01111B");
  assert.equal(early2019.curriculumScheme, "CBME_2019");
  assert.equal(early2019.curriculumBucket, "CBME");

  const fmtOld = SC.lookupQpCode("01204");
  assert.equal(fmtOld.profYear, "SECOND");
  assert.equal(fmtOld.paperNumber, null);
  assert.equal(fmtOld.curriculumScheme, "OLD");

  const c1203a = SC.lookupQpCode("C1203A");
  assert.equal(c1203a.source, "registry");
  assert.equal(c1203a.subject, "Microbiology");
  assert.equal(c1203a.verified, "inferred_from_series");
});

test("Normalizes OCR-corrupted codes cleanly before lookup", () => {
  const aabPt = SC.lookupQpCode("AAB0100022203 -Pt");
  assert.equal(aabPt.qpCode, "AAB0100022203-P1");
  assert.equal(aabPt.subject, "Microbiology");
  assert.equal(aabPt.paperNumber, 1);
  assert.equal(aabPt.curriculumScheme, "CBME_2019");

  const oOld = SC.lookupQpCode("O1201A");
  assert.equal(oOld.qpCode, "01201A");
  assert.equal(oOld.subject, "Pharmacology");
  assert.equal(oOld.curriculumScheme, "OLD");

  const ct202 = SC.lookupQpCode("ct202B");
  assert.equal(ct202.qpCode, "C1202B");
  assert.equal(ct202.subject, "Pathology");
  assert.equal(ct202.paperNumber, 2);

  const lowerC = SC.lookupQpCode("c1202B");
  assert.equal(lowerC.qpCode, "C1202B");
  assert.equal(lowerC.subject, "Pathology");

  const ciioib = SC.lookupQpCode("CIIOIB");
  assert.equal(ciioib.qpCode, "C1101B");
  assert.equal(ciioib.subject, "Anatomy");
  assert.equal(ciioib.paperNumber, 2);
});

test("Disambiguates ENT & Ophthalmology codes across THIRD_PART_1 and THIRD_PART_2", () => {
  const ophthalPt1 = SC.lookupQpCode("AAB0100027243202", "Third M.B.B.S. (2019) (Part - I) Examination");
  assert.equal(ophthalPt1.subject, "Ophthalmology");
  assert.equal(ophthalPt1.profYear, "THIRD_PART_1");
  assert.equal(ophthalPt1.curriculumScheme, "CBME_2019");
  assert.equal(ophthalPt1.requiresReview, false);

  const ophthalPt2 = SC.lookupQpCode("AAB0100027243202", "Third M.B.B.S. (2021) (Part - II) Examination");
  assert.equal(ophthalPt2.subject, "Ophthalmology");
  assert.equal(ophthalPt2.profYear, "THIRD_PART_2");
  assert.equal(ophthalPt2.curriculumScheme, "CBME_2021_SPLIT");

  const entPt2 = SC.lookupQpCode("AAB0100027243203", { headerText: "Final MBBS (CBME - 2023)", curriculumScheme: "CBME_2023" });
  assert.equal(entPt2.subject, "Otorhinolaryngology");
  assert.equal(entPt2.subjectId, "ent");
  assert.equal(entPt2.profYear, "THIRD_PART_2");
});

test("Resolves sequential Final MBBS ERP codes without -P1/-P2 suffixes", () => {
  const surg1 = SC.lookupQpCode("AAB0100027244206");
  assert.equal(surg1.subject, "General Surgery");
  assert.equal(surg1.profYear, "THIRD_PART_2");
  assert.equal(surg1.paperNumber, 1);

  const surg2 = SC.lookupQpCode("AAB0100027244207");
  assert.equal(surg2.subject, "General Surgery");
  assert.equal(surg2.profYear, "THIRD_PART_2");
  assert.equal(surg2.paperNumber, 2);

  const paeds = SC.lookupQpCode("AAB0100027244205");
  assert.equal(paeds.subject, "Paediatrics");
  assert.equal(paeds.paperNumber, null);
});

test("Disambiguates Summer/Winter 2026 unified policy on C11xx codes", () => {
  const summer2026Ph4 = SC.lookupQpCode("C1113A", { headerText: "Summer - 2026 Phase - IV", examSession: "SUMMER", examYear: 2026, examPhase: 4 });
  assert.equal(summer2026Ph4.curriculumScheme, "CBME_UNIFIED_2026");

  const model2024 = SC.lookupQpCode("C1113A", "First MBBS CBME (2024)");
  assert.equal(model2024.curriculumScheme, "CBME_2024");
});

test("Forward-compatible regex fallback handles future C121x / C13xx / C14xx codes", () => {
  const future2nd = SC.lookupQpCode("C1211A");
  assert.equal(future2nd.source, "regex_fallback");
  assert.equal(future2nd.requiresReview, true);
  assert.equal(future2nd.profYear, "SECOND");
  assert.equal(future2nd.subject, "Pharmacology");
  assert.equal(future2nd.paperNumber, 1);

  const future3rd = SC.lookupQpCode("C1304B");
  assert.equal(future3rd.source, "regex_fallback");
  assert.equal(future3rd.requiresReview, true);
  assert.equal(future3rd.profYear, "THIRD_PART_1");
  assert.equal(future3rd.paperNumber, 2);

  const future4th = SC.lookupQpCode("C1406A");
  assert.equal(future4th.source, "regex_fallback");
  assert.equal(future4th.requiresReview, true);
  assert.equal(future4th.profYear, "THIRD_PART_2");
  assert.equal(future4th.subject, "General Surgery");
});
