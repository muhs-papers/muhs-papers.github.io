/* ==========================================================================
   MUHS MBBS Question Paper Taxonomy, Header Parser, Dedup & Sorting
   Canonical domain rules (.agents/rules/muhs-paper-taxonomy.md).
   Isomorphic UMD module usable in both Node.js and browser globals.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./subject-codes.js"));
  } else {
    root.MUHS_TAXONOMY = factory(root.MUHS_SUBJECT_CODES || null);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (SUBJECT_CODES_MOD) {
  "use strict";

  function getSubjectCodesHelper() {
    if (SUBJECT_CODES_MOD) return SUBJECT_CODES_MOD;
    if (typeof globalThis !== "undefined" && globalThis.MUHS_SUBJECT_CODES) return globalThis.MUHS_SUBJECT_CODES;
    return null;
  }

  const PROF_YEARS = {
    FIRST: { id: "FIRST", legacyPhase: "phase1", label: "First MBBS", shortLabel: "1st MBBS", tag: "Pre-clinical" },
    SECOND: { id: "SECOND", legacyPhase: "phase2", label: "Second MBBS", shortLabel: "2nd MBBS", tag: "Para-clinical" },
    THIRD_PART_1: { id: "THIRD_PART_1", legacyPhase: "phase3a", label: "Third MBBS (Part I)", shortLabel: "3rd MBBS · Pt I", tag: "Clinical specialties" },
    THIRD_PART_2: { id: "THIRD_PART_2", legacyPhase: "phase3b", label: "Final MBBS (Part II)", shortLabel: "Final · Pt II", tag: "Final clinical" },
  };

  const SCHEME_LABELS = {
    OLD: "Old",
    CBME_2019: "CBME 2019",
    CBME_2021_SPLIT: "CBME 2021",
    CBME_2023: "CBME 2023",
    CBME_2024: "CBME 2024",
    CBME_UNIFIED_2026: "CBME 2026",
  };

  const SUBJECT_DEFS = [
    { id: "anatomy", name: "Anatomy", defaultProfYear: "FIRST", multiPaper: true, patterns: [/\banatomy\b/i] },
    { id: "physiology", name: "Physiology", defaultProfYear: "FIRST", multiPaper: true, patterns: [/\bphysiology\b/i] },
    { id: "biochemistry", name: "Biochemistry", defaultProfYear: "FIRST", multiPaper: true, patterns: [/\bbiochem(?:istry)?\b/i] },
    { id: "pathology", name: "Pathology", defaultProfYear: "SECOND", multiPaper: true, patterns: [/\bpathology\b/i] },
    { id: "pharmacology", name: "Pharmacology", defaultProfYear: "SECOND", multiPaper: true, patterns: [/\bpharmacology\b/i, /\btherapeutics\b/i] },
    { id: "microbiology", name: "Microbiology", defaultProfYear: "SECOND", multiPaper: true, patterns: [/\bmicrobiology\b/i] },
    { id: "forensic", name: "Forensic Medicine & Toxicology", defaultProfYear: "THIRD_PART_1", multiPaper: false, patterns: [/\bforens[il1]c\s+medicine\b/i, /\btoxicology\b/i, /\bf\.?\s*m\.?\s*t\.?\b/i] },
    { id: "ent", name: "ENT", defaultProfYear: "THIRD_PART_1", multiPaper: false, patterns: [/\botorhinolaryngology\b/i, /\be\.?\s*n\.?\s*t\.?\b/i, /\bear[\s,]+nose[\s,&]+throat\b/i] },
    { id: "ophthalmology", name: "Ophthalmology", defaultProfYear: "THIRD_PART_1", multiPaper: false, patterns: [/\bop[h]?thalmology\b/i] },
    { id: "community", name: "Community Medicine", defaultProfYear: "THIRD_PART_1", multiPaper: true, patterns: [/\bcommunity\s+medicine\b/i, /\bp\.?\s*s\.?\s*m\.?\b/i] },
    { id: "medicine", name: "General Medicine", defaultProfYear: "THIRD_PART_2", multiPaper: true, patterns: [/\bgeneral\s+medicine\b/i, /\bmedicine\s*(?:&|and)\s*allied/i] },
    { id: "surgery", name: "General Surgery", defaultProfYear: "THIRD_PART_2", multiPaper: true, patterns: [/\bgeneral\s+surgery\b/i, /\bsurgery\b/i] },
    { id: "pediatrics", name: "Paediatrics", defaultProfYear: "THIRD_PART_2", multiPaper: false, patterns: [/\bpa?ediatrics\b/i, /\bneonatology\b/i] },
    { id: "obgyn", name: "Obstetrics & Gynaecology", defaultProfYear: "THIRD_PART_2", multiPaper: true, patterns: [/\bobstetrics\b/i, /\bgyn[ae]*cology\b/i, /\bob\s*gyn\b/i] },
    { id: "orthopedics", name: "Orthopaedics", defaultProfYear: "THIRD_PART_2", multiPaper: false, patterns: [/\borthop[ae]*dics\b/i] },
    { id: "psychiatry", name: "Psychiatry", defaultProfYear: "THIRD_PART_2", multiPaper: false, patterns: [/\bpsychiatry\b/i] },
    { id: "dermatology", name: "Dermatology", defaultProfYear: "THIRD_PART_2", multiPaper: false, patterns: [/\bdermatology\b/i] },
    { id: "anesthesiology", name: "Anaesthesiology", defaultProfYear: "THIRD_PART_2", multiPaper: false, patterns: [/\ban[ae]*sthesiology\b/i] },
    { id: "radiology", name: "Radiodiagnosis", defaultProfYear: "THIRD_PART_2", multiPaper: false, patterns: [/\bradiodiagnosis\b/i, /\bradiology\b/i] },
  ];

  const SUBJECT_BY_ID = new Map(SUBJECT_DEFS.map((s) => [s.id, s]));
  const SUBJECT_BY_NAME = new Map(SUBJECT_DEFS.map((s) => [s.name.toLowerCase(), s]));

  const ROMAN_MAP = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

  function stripFooterBoilerplate(text) {
    return String(text || "")
      .replace(/\[?[ \t]*(?:Total[ \t]+)?No\.?[ \t]+of[ \t]+Pages[ \t]*:?[ \t]*\d+[ \t]*\]?/gi, " ")
      .replace(/\bTotal[ \t]+Duration[ \t]*:[^\r\n|]*/gi, " ")
      .replace(/\bSection[ \t]*[-–—]?[ \t]*["'`]?A["'`]?[ \t]*\+[ \t]*["'`]?B["'`]?(?:[ \t]*\+[ \t]*["'`]?C["'`]?)?/gi, " ")
      .replace(/\b(?:P\.?[ \t]*T\.?[ \t]*O\.?|Page[ \t]+\d+[ \t]+of[ \t]+\d+)\b/gi, " ");
  }

  function sanitizeOcrText(rawText) {
    let text = stripFooterBoilerplate(rawText);
    // Normalize unicode dashes and spaces around hyphens (horizontal whitespace only so line breaks stay intact)
    text = text.replace(/[–—−]/g, "-");
    text = text.replace(/[ \t]*-[ \t]*/g, " - ");
    // Normalize common OCR typos in session/attempt/phase/part keywords
    text = text.replace(/\bSumme[rreé](?=[^a-z]|$)/gi, "Summer");
    text = text.replace(/\bWintew(?=\d|\s|$)/gi, "Winter ");
    text = text.replace(/\bExam(?:ina\w*)?[ \t]*\|[ \t]*inter\b/gi, "Examination Winter");
    text = text.replace(/\bExam(?:ina\w*)?[ \t\r\n]+inter\b/gi, "Examination Winter");
    text = text.replace(/\bWinter[ \t]*-[ \t]*202[mO]\b/gi, "Winter - 2020");
    text = text.replace(/\bSupp[Il1]ementary\b/gi, "Supplementary");
    text = text.replace(/\bPart\s*-\s*1\b/gi, "Part - I");
    text = text.replace(/\bPart\s*-\s*2\b/gi, "Part - II");
    text = text.replace(/\bPhase\s*-\s*(?:111|III|Jit|Ill|lIl)\b/gi, "Phase - III");
    text = text.replace(/\bPhase\s*-\s*(?:\[V|1V|lV|IV)\b/gi, "Phase - IV");
    text = text.replace(/\bPhase\s*-\s*(?:11|II|ll|lI)\b/gi, "Phase - II");
    text = text.replace(/\bPhase\s*-\s*(?:1|I|l)\b/gi, "Phase - I");
    // Normalize lowercase/O/I-misread QP codes while preserving words
    text = text.replace(/\b[oO]([01][1-4]\d{2}[aAbB]?)\b/g, (_, rest) => "0" + rest.toUpperCase());
    text = text.replace(/\b01([1-4])(\d{2})\s*\(\s*([AB])\s*\)/gi, (_, y, d, s) => "01" + y + d + s.toUpperCase());
    text = text.replace(/\b01([1-4])(\d{2})\s+([AB])\b/gi, (_, y, d, s) => "01" + y + d + s.toUpperCase());
    text = text.replace(/\bC[1TIIL]([1-4IL])([O0\d])([O0IL1\d])([AB])?\b/gi, (_, d1, d2, d3, s) => {
      const n1 = /[Il1]/i.test(d1) ? "1" : d1;
      const n2 = /[O0]/i.test(d2) ? "0" : d2;
      const n3 = /[O0]/i.test(d3) ? "0" : /[Il1]/i.test(d3) ? "1" : d3;
      return "C1" + n1 + n2 + n3 + (s ? s.toUpperCase() : "");
    });
    text = text.replace(/\b[cC]1([1-4]\d{2})([aAbB])?\b/g, (_, digits, suffix) => "C1" + digits + (suffix ? suffix.toUpperCase() : ""));
    text = text.replace(/\baab01000(\d+)(?:[ \t]*-[ \t]*[pP](II|LL|T|I|L|[12]))?\b/gi, (_, digits, p) => {
      if (!p) return "AAB01000" + digits;
      const tok = p.toUpperCase();
      return "AAB01000" + digits + (tok === "II" || tok === "LL" || tok === "2" ? "-P2" : "-P1");
    });
    return text;
  }

  function extractQpCode(sanitized) {
    const sc = getSubjectCodesHelper();
    const norm = (code) => (sc && code ? sc.normalizeQpCode(code) : String(code || "").toUpperCase());
    const cMatch = sanitized.match(/\b(C1[1-4]\d{2}[AB]?)\b/i);
    if (cMatch) return norm(cMatch[1]);
    const aabMatches = [...sanitized.matchAll(/\b(AAB01000\d+(?:-P[12])?)\b/gi)].map((m) => norm(m[1]));
    if (aabMatches.length) {
      aabMatches.sort((a, b) => b.length - a.length);
      return aabMatches[0];
    }
    const oldMatch = sanitized.match(/\b(01[1-4]\d{2}[AB]?)\b/i);
    if (oldMatch) return norm(oldMatch[1]);
    return null;
  }

  function parsePhase(sanitized) {
    const m = sanitized.match(/\bPhase\s*(?:-|\s)\s*(VI|IV|V|III|II|I|[1-6])\b/i);
    if (!m) return null;
    const tok = m[1].toUpperCase();
    if (ROMAN_MAP[tok]) return ROMAN_MAP[tok];
    const n = Number(tok);
    return n >= 1 && n <= 6 ? n : null;
  }

  function parseSessionYear(sanitized) {
    const m = sanitized.match(/\b(Summer|Winter)(?:(?!\bSummer\b|\bWinter\b)[\s\S]){0,110}?(20\d{2})\b/i);
    if (!m) return { examSession: null, examYear: null };
    return {
      examSession: m[1].toUpperCase() === "WINTER" ? "WINTER" : "SUMMER",
      examYear: Number(m[2]),
    };
  }

  function parseAttemptType(sanitized) {
    return /\b(Supplementary|Suppl|Supple)\.?\b/i.test(sanitized) ? "SUPPLEMENTARY" : "REGULAR";
  }

  function resolveCurriculumScheme({ sanitized, qpCode, profYear, examSession, examYear, actualExamDate }) {
    const isOldTag = /\(\s*OLD(?:\s+SCHEME)?\s*\)/i.test(sanitized) || /\bOLD\s+COURSE\b/i.test(sanitized);
    const has2024Tag = /\(\s*CBME\s*(?:-|\s)\s*2024\s*\)/i.test(sanitized) || /\bCBME\s*\(\s*2024\s*\)/i.test(sanitized);
    const has2023Tag = /\(\s*CBME\s*(?:-|\s)\s*2023\s*\)/i.test(sanitized) || /\bCBME\s*\(\s*2023\s*\)/i.test(sanitized);
    const has2021Tag = /\(\s*(?:CBME\s*(?:-|\s)\s*)?2021\s*\)/i.test(sanitized) || /\bCBME\s*\(\s*2021\s*\)/i.test(sanitized);
    const has2019Tag = /\(\s*(?:CBME\s*(?:-|\s)\s*)?2019\s*\)/i.test(sanitized) || /\bCBME\s*\(\s*2019\s*\)/i.test(sanitized);
    const hasUnifiedTag = /\bUNIFIED\s+CBME\b/i.test(sanitized) || /\bMUHS\/X-1\/2261\/2026\b/i.test(sanitized);

    // Aug 2026 unified common CBME policy (effective 01 Aug 2026); OLD remains separate.
    const isAug2026OrLater =
      hasUnifiedTag ||
      (actualExamDate && String(actualExamDate) >= "2026-08-01") ||
      (!isOldTag && Number(examYear) >= 2026 && (examSession === "WINTER" || Number(examYear) > 2026));

    if (qpCode) {
      if (/^C1([1-4])(\d{2})([AB])?$/i.test(qpCode)) {
        if (isAug2026OrLater) return "CBME_UNIFIED_2026";
        if (has2024Tag) return "CBME_2024";
        if (has2023Tag) return "CBME_2023";
        return "CBME_2023";
      }
      if (/^AAB01000\d+(?:-P([12]))?$/i.test(qpCode)) {
        if (isAug2026OrLater) return "CBME_UNIFIED_2026";
        if (has2021Tag || profYear === "THIRD_PART_2") return "CBME_2021_SPLIT";
        return "CBME_2019";
      }
      if (/^01([1-4])(\d{2})([AB])?$/i.test(qpCode)) {
        if (/^0111[1-3][AB]?$/i.test(qpCode) && has2019Tag) {
          return "CBME_2019";
        }
        return "OLD";
      }
    }

    if (isOldTag) return "OLD";
    if (isAug2026OrLater) return "CBME_UNIFIED_2026";
    if (has2024Tag) return "CBME_2024";
    if (has2023Tag) return "CBME_2023";
    if (has2021Tag) return "CBME_2021_SPLIT";
    if (has2019Tag) return "CBME_2019";
    if (/\bCBME\b/i.test(sanitized)) return "CBME_2023";
    return null;
  }

  function parseProfYearFromHeader(sanitized, qpCode) {
    if (/\bFirst\s+(?:M\.?\s*B\.?\s*B\.?\s*S\.?|MBBS)\b/i.test(sanitized)) return "FIRST";
    if (/\bSecond\s+(?:M\.?\s*B\.?\s*B\.?\s*S\.?|MBBS)\b/i.test(sanitized)) return "SECOND";
    if (/\bFinal\s+(?:M\.?\s*B\.?\s*B\.?\s*S\.?|MBBS)\b/i.test(sanitized)) return "THIRD_PART_2";
    if (/\bThird\s+(?:M\.?\s*B\.?\s*B\.?\s*S\.?|MBBS)\b/i.test(sanitized)) {
      if (/(?:\bPart\s*-\s*II\b|\bThird\s*\(\s*II\s*\))/i.test(sanitized)) {
        return "THIRD_PART_2";
      }
      if (/(?:\bPart\s*-\s*I\b|\bThird\s*\(\s*I\s*\))/i.test(sanitized)) {
        return "THIRD_PART_1";
      }
      return "THIRD_PART_1";
    }
    if (qpCode) {
      const m = qpCode.match(/^(?:C1|01)([1-4])/i);
      if (m) {
        if (m[1] === "1") return "FIRST";
        if (m[1] === "2") return "SECOND";
        if (m[1] === "3") return "THIRD_PART_1";
        if (m[1] === "4") return "THIRD_PART_2";
      }
    }
    return null;
  }

  function resolveSubjectDef(sanitized, subjectHintId) {
    // Check explicit subject line markers before broad matching to avoid header words misleading
    const lines = sanitized.split(/\r?\n| \| /).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      for (const def of SUBJECT_DEFS) {
        if (def.patterns.some((re) => re.test(line))) {
          return def;
        }
      }
    }
    for (const def of SUBJECT_DEFS) {
      if (def.patterns.some((re) => re.test(sanitized))) return def;
    }
    if (/^\s*medicine(?:\s*-\s*(?:II|I|1|2))?\s*$/im.test(sanitized)) return SUBJECT_BY_ID.get("medicine");
    if (subjectHintId && SUBJECT_BY_ID.has(subjectHintId)) return SUBJECT_BY_ID.get(subjectHintId);
    return null;
  }

  function applySubjectYearShift(subjectDef, profYear, curriculumScheme) {
    if (!subjectDef) return profYear;
    if (subjectDef.id === "forensic") {
      if (curriculumScheme === "OLD") return "SECOND";
      if (curriculumScheme) return "THIRD_PART_1";
    }
    if (subjectDef.id === "ent" || subjectDef.id === "ophthalmology") {
      if (curriculumScheme === "OLD" || curriculumScheme === "CBME_2019") return "THIRD_PART_1";
      if (
        curriculumScheme === "CBME_2021_SPLIT" ||
        curriculumScheme === "CBME_2023" ||
        curriculumScheme === "CBME_2024" ||
        curriculumScheme === "CBME_UNIFIED_2026"
      ) {
        return "THIRD_PART_2";
      }
    }
    // Non-shifting subjects belong strictly to their canonical MBBS Prof Year (never downgrade Surgery/Medicine/ObsGyn/Paeds if OCR misreads Part - II as Part - I).
    return subjectDef.defaultProfYear || profYear;
  }

  function parsePaperNumber(sanitized, qpCode, subjectDef) {
    if (qpCode) {
      const cOrOld = qpCode.match(/^(?:C1|01)[1-4]\d{2}([AB])$/i);
      if (cOrOld) return cOrOld[1].toUpperCase() === "B" ? 2 : 1;
      const aabPart = qpCode.match(/^AAB01000\d+-P([12])$/i);
      if (aabPart) return Number(aabPart[1]);
    }
    if (subjectDef && !subjectDef.multiPaper) {
      // Single-paper subject unless an explicit Paper I / II marker appears with subject/paper word
      const explicitSingleMulti = sanitized.match(/\bPaper\s*(?:-|\s)*\s*(II|I|2|1)\b/i);
      if (!explicitSingleMulti) return null;
      const tok = explicitSingleMulti[1].toUpperCase();
      return tok === "II" || tok === "2" ? 2 : 1;
    }
    // Mask out Third MBBS (Part - I/II) and Phase - I..VI so they are never confused with Paper I/II
    const cleaned = sanitized
      .replace(/\bPart\s*-\s*(?:II|I)\b/gi, " ")
      .replace(/\bPhase\s*-\s*(?:VI|IV|V|III|II|I|[1-6])\b/gi, " ");
    const paperWord = cleaned.match(/\bPaper\s*(?:-|\s)*\s*(II|I|2|1)\b/i);
    if (paperWord) {
      const tok = paperWord[1].toUpperCase();
      return tok === "II" || tok === "2" ? 2 : 1;
    }
    if (subjectDef) {
      for (const re of subjectDef.patterns) {
        const subPart = cleaned.match(new RegExp(re.source + "(?:\\s|\\(|-|_|:)*(?:Paper)?\\s*-?\\s*(II|I|2|1)\\b", "i"));
        if (subPart) {
          const tok = subPart[1].toUpperCase();
          return tok === "II" || tok === "2" ? 2 : 1;
        }
      }
    }
    // Check standalone line endings like "... | ANATOMY - I" or "ANATOMY - II"
    const tail = cleaned.match(/(?:^|\|\s*)[^|]*\s-\s*(II|I|2|1)\s*$/m);
    if (tail) {
      const tok = tail[1].toUpperCase();
      return tok === "II" || tok === "2" ? 2 : 1;
    }
    return null;
  }

  function parseHeader(rawHeaderText, options) {
    const opts = options || {};
    const raw = String(rawHeaderText || "");
    const sanitized = sanitizeOcrText(raw);
    const qpCode = extractQpCode(sanitized);
    const { examSession, examYear } = parseSessionYear(sanitized);
    const examPhase = parsePhase(sanitized);
    const attemptType = parseAttemptType(sanitized);
    const rawProfYear = parseProfYearFromHeader(sanitized, qpCode);
    const sc = getSubjectCodesHelper();
    const qpLookup = qpCode && sc ? sc.lookupQpCode(qpCode, {
      headerText: sanitized,
      profYear: rawProfYear,
      examSession,
      examYear,
      examPhase,
      actualExamDate: opts.actualExamDate || null,
    }) : null;

    const subjectDef =
      (qpLookup && qpLookup.subjectId && SUBJECT_BY_ID.get(qpLookup.subjectId)) ||
      resolveSubjectDef(sanitized, opts.subjectIdHint);
    const heuristicScheme = resolveCurriculumScheme({
      sanitized,
      qpCode,
      profYear: rawProfYear,
      examSession,
      examYear,
      actualExamDate: opts.actualExamDate || null,
    });
    const curriculumScheme =
      (qpLookup && qpLookup.curriculumScheme) ||
      heuristicScheme ||
      opts.defaultScheme ||
      null;
    const profYear =
      (qpLookup && qpLookup.profYear) ||
      applySubjectYearShift(subjectDef, rawProfYear, curriculumScheme);
    const paperNumber =
      qpLookup && (qpLookup.paperNumber != null || qpLookup.source === "registry")
        ? qpLookup.paperNumber
        : parsePaperNumber(sanitized, qpCode, subjectDef);
    const curriculumBucket = curriculumScheme === "OLD" ? "OLD" : curriculumScheme ? "CBME" : null;

    return {
      qpCode,
      qpSource: qpLookup ? qpLookup.source : null,
      qpRequiresReview: qpLookup ? qpLookup.requiresReview : false,
      profYear,
      subjectId: subjectDef ? subjectDef.id : opts.subjectIdHint || null,
      subject: subjectDef ? subjectDef.name : (qpLookup && qpLookup.subject) || null,
      paperNumber,
      curriculumScheme,
      curriculumBucket,
      examSession,
      examYear,
      examPhase,
      attemptType,
      actualExamDate: opts.actualExamDate || null,
      inferredCohortHint: opts.inferredCohortHint || null,
      rawHeaderText: raw,
    };
  }

  function chronologicalSortKey(paper) {
    const year = Number(paper.examYear ?? paper.year) || 0;
    const sess = String(paper.examSession || paper.session || "").toUpperCase();
    const attempt = String(paper.attemptType || "REGULAR").toUpperCase();
    const phase = paper.examPhase == null ? 0 : Number(paper.examPhase) || 0;
    return (
      year * 1000 +
      (sess === "WINTER" ? 100 : 0) +
      (attempt === "SUPPLEMENTARY" ? 10 : 0) +
      phase
    );
  }

  function comparePapersRecency(a, b) {
    const diff = chronologicalSortKey(b) - chronologicalSortKey(a);
    if (diff !== 0) return diff;
    const pa = a.paperNumber == null ? 99 : Number(a.paperNumber);
    const pb = b.paperNumber == null ? 99 : Number(b.paperNumber);
    if (pa !== pb) return pa - pb;
    return String(b.addedAt || "").localeCompare(String(a.addedAt || ""));
  }

  function dedupKey(paper, includePhase) {
    const profYear = paper.profYear || "";
    const subject = paper.subject || (SUBJECT_BY_ID.get(paper.subjectId)?.name || paper.subjectId || "");
    const paperNum = paper.paperNumber == null ? "null" : String(paper.paperNumber);
    const scheme = paper.curriculumScheme || "";
    const examYear = paper.examYear ?? paper.year ?? "null";
    const examSession = String(paper.examSession || paper.session || "").toUpperCase();
    const attemptType = String(paper.attemptType || "REGULAR").toUpperCase();
    const examPhase = includePhase ? (paper.examPhase == null ? "null" : String(paper.examPhase)) : "*";
    return [profYear, subject, paperNum, scheme, examYear, examSession, attemptType, examPhase].join("|");
  }

  function isSamePaperRecord(a, b) {
    const strict = dedupKey(a, true) === dedupKey(b, true);
    if (strict) return true;
    // Fall back without examPhase only if missing on one copy.
    if ((a.examPhase == null) !== (b.examPhase == null)) {
      return dedupKey(a, false) === dedupKey(b, false);
    }
    return false;
  }

  function deduplicatePapers(papers) {
    const result = [];
    for (const item of papers) {
      if (!result.some((existing) => isSamePaperRecord(existing, item))) {
        result.push(item);
      }
    }
    return result;
  }

  function formatSchemeBadge(scheme) {
    return SCHEME_LABELS[scheme] || scheme || "CBME";
  }

  function formatAttemptLabel(attemptType) {
    return String(attemptType || "").toUpperCase() === "SUPPLEMENTARY" ? "Suppl." : "Regular";
  }

  function formatSessionLabel(session) {
    const s = String(session || "").toUpperCase();
    if (s === "WINTER") return "Winter";
    if (s === "SUMMER") return "Summer";
    return session || "";
  }

  function formatCardMetaLine(paper) {
    const sess = formatSessionLabel(paper.examSession || paper.session);
    const yr = paper.examYear ?? paper.year;
    const exam = sess && yr ? sess + " " + yr : "Session pending";
    const attempt = formatAttemptLabel(paper.attemptType);
    const badge = formatSchemeBadge(paper.curriculumScheme);
    return exam + " · " + attempt + " · " + badge;
  }

  function formatPaperTitle(paper) {
    const subject = paper.subject || (SUBJECT_BY_ID.get(paper.subjectId)?.name || "Paper");
    const part = paper.paperNumber === 1 ? "Paper I" : paper.paperNumber === 2 ? "Paper II" : "";
    const sess = formatSessionLabel(paper.examSession || paper.session);
    const yr = paper.examYear ?? paper.year;
    const attempt = String(paper.attemptType || "").toUpperCase() === "SUPPLEMENTARY" ? " (Supplementary)" : "";
    const parts = [subject];
    if (part) parts.push(part);
    if (sess && yr) parts.push(sess + " " + yr + attempt);
    return parts.join(" — ");
  }

  return {
    PROF_YEARS,
    SUBJECT_DEFS,
    SUBJECT_BY_ID,
    SUBJECT_BY_NAME,
    SCHEME_LABELS,
    sanitizeOcrText,
    stripFooterBoilerplate,
    parseHeader,
    chronologicalSortKey,
    comparePapersRecency,
    dedupKey,
    isSamePaperRecord,
    deduplicatePapers,
    applySubjectYearShift,
    formatSchemeBadge,
    formatAttemptLabel,
    formatSessionLabel,
    formatCardMetaLine,
    formatPaperTitle,
  };
});
