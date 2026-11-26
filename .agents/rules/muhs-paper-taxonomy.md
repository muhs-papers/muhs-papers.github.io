---
trigger: model_decision
description: "Apply whenever designing database schemas, ingestion parsers, OCR pipelines, search filters, sorting logic, or UI grouping for MUHS MBBS university question papers (Summer/Winter sessions, curriculum schemes, paper codes, scheduling phases, and supplementary attempts)."
---

# MUHS MBBS Question Paper Taxonomy & Segregation Rules

## 1. Non-Negotiable Domain Invariants
1. **Bracketed tags are Curriculum Schemes, NOT admission batches.**
   - `(OLD)`, `(2019)`, `(2021)`, `(CBME-2023)`, and `(CBME-2024)` identify syllabus/paper-skeleton regulations, not single student cohorts (e.g., `(2019)` covers 2019–2022 batches).
   - Never store bracketed header tags in `admissionBatch` or `studentBatch`; always store them as `curriculumScheme`.
2. **`Phase - I` through `Phase - VI` are administrative scheduling waves, NOT MBBS years.**
   - Example: `First M.B.B.S. (CBME - 2023) ... Summer - 2024 Phase - II` is a **1st-year** MBBS paper in the 2nd exam wave.
   - Always derive `profYear` from `First`, `Second`, `Third (I)`/`Part - I`, or `Third (II)`/`Part - II` (or the paper code), never from `Phase`.
3. **`Summer - YYYY` and `Winter - YYYY` are official MUHS exam cycles, NOT literal calendar dates.**
   - `Winter - YYYY` exams often run in Jan–Mar of `YYYY + 1` (e.g., `Winter - 2023` 2nd MBBS ran in Jan 2024; `Winter - 2025 Phase - IV` started Mar 2026).
   - `Summer - YYYY` supplementary waves often run in Nov–Dec of `YYYY` (e.g., `Summer - 2025 Phase - V` ran Nov–Dec 2025).
   - Keep `examSession` + `examYear` strictly separate from optional `actualExamDate`.
4. **Never hardcode "Summer = Regular" or "Winter = Supplementary."**
   - Regular cohorts shift across Summer/Winter depending on academic calendar alignment.
   - Under CBME, both regular and immediate supplementary exams often share the exact same `Summer - YYYY` or `Winter - YYYY` label, differentiated only by the `Supplementary` keyword and a higher `examPhase`.
5. **August 2026 Unified CBME Common Paper Policy.**
   - Per MUHS Circular `MUHS/X-1/2261/2026` (effective from exams starting 01 Aug 2026), separate theory papers for `CBME-2019`, `CBME-2023`, and `CBME-2024` are abolished in favor of one common CBME paper (`CBME_UNIFIED_2026`). Only `OLD` stays separate.
6. **Printed headers override third-party filenames.**
   - Guessed batch names in filenames (e.g., `"2021 Batch"`) must only go into a non-authoritative `inferredCohortHint` field.

## 2. Canonical Data Model
- `qpCode`: string | null (top-right subject/QP code)
- `profYear`: `"FIRST" | "SECOND" | "THIRD_PART_1" | "THIRD_PART_2"`
- `subject`: canonical subject string
- `paperNumber`: `1 | 2 | null` (`null` for single-paper subjects like FMT)
- `curriculumScheme`: `"OLD" | "CBME_2019" | "CBME_2021_SPLIT" | "CBME_2023" | "CBME_2024" | "CBME_UNIFIED_2026"`
- `curriculumBucket`: `"OLD"` if `curriculumScheme === "OLD"`, else `"CBME"`
- `examSession`: `"SUMMER" | "WINTER"`
- `examYear`: 4-digit integer attached to Summer/Winter
- `examPhase`: integer `1..6` | null (scheduling wave only)
- `attemptType`: `"REGULAR" | "SUPPLEMENTARY"`
- `actualExamDate`: optional ISO date string
- `inferredCohortHint`: optional non-authoritative string
- `rawHeaderText`: exact extracted header text

## 3. Parsing Priority & Paper-Code Rules
0. **Canonical Subject-Code Registry (`muhs-subject-codes.json` + `subject-codes.js`):**
   - Resolve top-right QP codes deterministically via `lookupQpCode(rawCode, headerContext)` against `muhs-subject-codes.json` before falling back to heuristic text matching.
   - **First MBBS dual `C`-series families:** `C1101A`–`C1103B` identify `CBME_2023` (and Summer 2026 Phase-III unified papers); `C1111A`–`C1113B` identify `CBME_2024` (and Summer 2026 Phase-IV unified papers).
   - **Third (II) MBBS sequential ERP codes:** Final MBBS ERP codes (`AAB0100027244201`–`4207`) encode Paper I and Paper II via distinct consecutive numbers (`4201`/`4202` OBGYN, `4203`/`4204` Medicine, `4206`/`4207` Surgery; `4205` Paediatrics single paper) rather than `-P1`/`-P2` suffixes.
   - **Reused Third MBBS single-paper ERP codes:** `AAB0100027243202` (Ophthalmology) and `AAB0100027243203` (Otorhinolaryngology / ENT) are reused verbatim across `THIRD_PART_1` (`CBME_2019`) and `THIRD_PART_2` (`CBME_2021_SPLIT` / `CBME_2023`); disambiguate `profYear` using header `Part - I` / `Part - II` or scheme context.
1. **QP Code (highest-reliability validation/fallback):**
   - `/^C1([1-4])(\d{2})([AB])?$/i` -> `CBME_2023`, `CBME_2024`, or `CBME_UNIFIED_2026` (`A`=Paper I, `B`=Paper II). Future `C121x` / `C13xx` / `C14xx` codes not yet in `muhs-subject-codes.json` fall back to regex with `source: "regex_fallback"` flagged for review.
   - `/^AAB01000\d+(?:-P([12]))?$/i` -> `CBME_2019` (or `CBME_2021_SPLIT` in 3rd Yr; `-P1`/`-P2` = Paper I/II).
   - `/^01([1-4])(\d{2})([AB])?$/i` -> `OLD`, **except** `0111[1-3][AB]` with `(2019)` in header, which is early `CBME_2019` 1st MBBS.
2. **Subject Year Shifts:**
   - FMT is `SECOND` under `OLD`, and `THIRD_PART_1` under all CBME schemes.
   - ENT & Ophthalmology are `THIRD_PART_1` under `OLD` and `CBME_2019`, and `THIRD_PART_2` under `CBME_2021_SPLIT` and newer.
3. **Session, Phase, Attempt:**
   - Session/Year: `/(Summer|Winter)\s*[-–—]?\s*(20\d{2})/i`
   - Phase (can appear before or after session): `/Phase\s*[-–—]?\s*(VI|IV|V|III|II|I|[1-6])\b/i`
   - Attempt: `"SUPPLEMENTARY"` if `Supplementary|Suppl|Supple` appears; else `"REGULAR"`.
4. **OCR Sanitization (apply before regex):**
   - Normalize `Part - 1` -> `Part - I`, `Phase - 11` -> `Phase - II`, lowercase `c1202b` -> `C1202B`, leading letter `O` in `O1201A` -> `01201A`, and flexible spacing around hyphens.
   - Ignore footer boilerplate (`Section A+B+C`, `Total No. of Pages`) when reading paper/phase numbers.

## 4. Deduplication, Sorting & UI Segregation
- **Deduplication Tuple:** `(profYear, subject, paperNumber, curriculumScheme, examYear, examSession, attemptType, examPhase)` (fall back without `examPhase` only if missing on one copy). Never deduplicate solely on `(subject, examYear, examSession)`.
- **Chronological Sort Key:** `examYear * 1000 + (examSession === "WINTER" ? 100 : 0) + (attemptType === "SUPPLEMENTARY" ? 10 : 0) + (examPhase ?? 0)`.
- **UI Hierarchy:** `Prof Year -> Subject -> Paper I/II`, with `curriculumBucket` defaulted to **CBME** and **OLD (Pre-2019)** segregated into a secondary tab/toggle.
- **Card Display Format:** `{Session} {Year} · {Regular|Suppl.} · {CurriculumBadge}` (keep `Phase` in secondary metadata/tooltip so users do not confuse it with MBBS year).

## 5. Required Parser Unit Test Fixtures
1. `C1101A | FIRST M.B.B.S. (CBME - 2023) Supplementary Examination, Summer - 2024 Phase - II | ANATOMY - I` -> `FIRST`, `Anatomy`, Paper `1`, `CBME_2023`, `SUMMER` `2024`, Phase `2`, `SUPPLEMENTARY`
2. `AAB0100022201-P1 | Second M.B.B.S. (2019) Examination, (Phase - III) Winter - 2023 | PHARMACOLOGY - I` -> `SECOND`, `Pharmacology`, Paper `1`, `CBME_2019`, `WINTER` `2023`, Phase `3`, `REGULAR`
3. `AAB0100027243204 | Third M.B.B.S. (2019) (Part - 1) Examination, Winter - 2022 | FORENSIC MEDICINE & TOXICOLOGY` -> `THIRD_PART_1`, `Forensic Medicine & Toxicology`, Paper `null`, `CBME_2019`, `WINTER` `2022`, Phase `null`, `REGULAR`
4. `c1202B | SECOND M.B.B.S. (CBME-2023) Supplementary Examination, Summer - 2025 Phase - V | PATHOLOGY - II` -> `SECOND`, `Pathology`, Paper `2`, `CBME_2023`, `SUMMER` `2025`, Phase `5`, `SUPPLEMENTARY`
5. `01201A | Second M.B.B.S. (OLD) Examination, Summer - 2024 | PHARMACOLOGY - I` -> `SECOND`, `Pharmacology`, Paper `1`, `OLD`, `SUMMER` `2024`, Phase `null`, `REGULAR`
