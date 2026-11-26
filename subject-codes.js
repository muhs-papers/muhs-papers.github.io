// @ts-check
/* ==========================================================================
   MUHS MBBS Subject-Code Lookup & OCR Normalization Helper
   Deterministic resolution from top-right QP codes against
   muhs-subject-codes.json, with header disambiguation and forward-compatible
   regex fallback. Isomorphic UMD module (Node.js + browser).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const registry = require("./muhs-subject-codes.json");
    module.exports = factory(registry);
  } else {
    root.MUHS_SUBJECT_CODES = factory(null);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (initialRegistry) {
  "use strict";

  /**
   * @typedef {"FIRST" | "SECOND" | "THIRD_PART_1" | "THIRD_PART_2"} ProfYear
   * @typedef {"OLD" | "CBME_2019" | "CBME_2021_SPLIT" | "CBME_2023" | "CBME_2024" | "CBME_UNIFIED_2026"} CurriculumScheme
   * @typedef {"CBME" | "OLD"} CurriculumBucket
   *
   * @typedef {Object} SubjectCodeEntry
   * @property {ProfYear[]} profYears
   * @property {string} subject
   * @property {string[]} [aliases]
   * @property {1 | 2 | null} paperNumber
   * @property {CurriculumScheme[]} curriculumSchemes
   * @property {CurriculumBucket} curriculumBucket
   * @property {boolean} [requiresHeaderDisambiguation]
   * @property {boolean | string} verified
   *
   * @typedef {Object} HeaderContext
   * @property {string} [headerText]
   * @property {ProfYear | null} [profYear]
   * @property {CurriculumScheme | null} [curriculumScheme]
   * @property {string | null} [examSession]
   * @property {number | null} [examYear]
   * @property {number | null} [examPhase]
   * @property {string | null} [actualExamDate]
   *
   * @typedef {Object} QpLookupResult
   * @property {string} qpCode
   * @property {string} rawCode
   * @property {"registry" | "regex_fallback"} source
   * @property {ProfYear | null} profYear
   * @property {ProfYear[]} profYears
   * @property {string | null} subject
   * @property {string | null} subjectId
   * @property {1 | 2 | null} paperNumber
   * @property {CurriculumScheme | null} curriculumScheme
   * @property {CurriculumScheme[]} curriculumSchemes
   * @property {CurriculumBucket | null} curriculumBucket
   * @property {boolean} requiresReview
   * @property {boolean | string} verified
   */

  /** @type {{ version?: string, university?: string, course?: string, notes?: string[], codes: Record<string, SubjectCodeEntry> }} */
  let registry = initialRegistry || { codes: {} };

  /** @type {Record<string, string>} */
  const SUBJECT_NAME_TO_ID = {
    anatomy: "anatomy",
    physiology: "physiology",
    biochemistry: "biochemistry",
    pathology: "pathology",
    pharmacology: "pharmacology",
    "pharmacology & therapeutics": "pharmacology",
    microbiology: "microbiology",
    "forensic medicine & toxicology": "forensic",
    fmt: "forensic",
    otorhinolaryngology: "ent",
    ent: "ent",
    "e.n.t.": "ent",
    ophthalmology: "ophthalmology",
    "community medicine": "community",
    psm: "community",
    "general medicine": "medicine",
    "medicine & allied subjects": "medicine",
    "general surgery": "surgery",
    paediatrics: "pediatrics",
    pediatrics: "pediatrics",
    "obstetrics & gynaecology": "obgyn",
    obgyn: "obgyn",
  };

  /** @type {Record<string, Record<string, string>>} */
  const C_SERIES_FALLBACK_SUBJECTS = {
    "1": { "01": "Anatomy", "02": "Physiology", "03": "Biochemistry", "11": "Anatomy", "12": "Physiology", "13": "Biochemistry" },
    "2": { "01": "Pharmacology", "02": "Pathology", "03": "Microbiology", "11": "Pharmacology", "12": "Pathology", "13": "Microbiology" },
    "3": { "01": "Community Medicine", "02": "Ophthalmology", "03": "Otorhinolaryngology", "04": "Forensic Medicine & Toxicology" },
    "4": { "01": "Obstetrics & Gynaecology", "02": "Obstetrics & Gynaecology", "03": "General Medicine", "04": "General Medicine", "05": "Paediatrics", "06": "General Surgery", "07": "General Surgery" },
  };

  /**
   * Maps a canonical subject name or alias to app `subjectId`.
   * @param {string | null | undefined} name
   * @returns {string | null}
   */
  function resolveSubjectId(name) {
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    return SUBJECT_NAME_TO_ID[key] || null;
  }

  /**
   * Injects or updates the canonical lookup registry (for browser runtime loading).
   * @param {{ codes?: Record<string, SubjectCodeEntry> } | null} nextRegistry
   */
  function setRegistry(nextRegistry) {
    if (nextRegistry && nextRegistry.codes && typeof nextRegistry.codes === "object") {
      registry = /** @type {typeof registry} */ (nextRegistry);
    }
  }

  /**
   * Fetches and installs `muhs-subject-codes.json` in browser environments.
   * @param {string} [url]
   * @returns {Promise<boolean>}
   */
  async function load(url) {
    if (typeof fetch !== "function") return Boolean(Object.keys(registry.codes || {}).length);
    try {
      const res = await fetch(url || "./muhs-subject-codes.json");
      if (!res.ok) return false;
      const data = await res.json();
      setRegistry(data);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Normalizes OCR noise on incoming MUHS QP codes before lookup.
   * @param {string | null | undefined} rawCode
   * @returns {string}
   */
  function normalizeQpCode(rawCode) {
    if (!rawCode) return "";
    let s = String(rawCode).trim().toUpperCase();
    // Replace Unicode dashes and spaces around hyphens
    s = s.replace(/[–—−]/g, "-").replace(/\s*-\s*/g, "-");
    // Collapse internal spaces between 5-digit OLD/early codes and A/B or (A)/(B)
    s = s.replace(/^([O0]1[1-4]\d{2})\s*\(?\s*([AB])\s*\)?$/, "$1$2");
    // Strip remaining spaces
    s = s.replace(/\s+/g, "");

    // Fix suffix OCR typos on AAB... ERP codes (-Pt, -PI, -Pl -> -P1; -PII, -PLL -> -P2)
    s = s.replace(/^(AAB01000\d+)-P(?:II|LL|2)$/i, "$1-P2");
    s = s.replace(/^(AAB01000\d+)-P(?:T|I|L|1)$/i, "$1-P1");

    // Fix leading letter O -> 0 on OLD / 0111x codes (O1201A -> 01201A)
    s = s.replace(/^O(1[1-4]\d{2}[AB]?)$/, "0$1");

    // Fix C-series OCR corruptions: ct202B -> C1202B, CIIOIB -> C1101B, etc.
    const cMatch = s.match(/^C([1TIIL])([1-4IL])([O0\d])([O0IL1\d])([AB])?$/);
    if (cMatch) {
      const d1 = /[1-4]/.test(cMatch[2]) ? cMatch[2] : "1";
      const d2 = /[O0]/.test(cMatch[3]) ? "0" : cMatch[3];
      const d3 = /[O0]/.test(cMatch[4]) ? "0" : /[IL1]/.test(cMatch[4]) ? "1" : cMatch[4];
      const suffix = cMatch[5] || "";
      s = "C1" + d1 + d2 + d3 + suffix;
    }

    return s;
  }

  /**
   * Normalizes string or object header context into consistent lookup hints.
   * @param {string | HeaderContext | undefined} headerContext
   * @returns {HeaderContext}
   */
  function normalizeContext(headerContext) {
    if (!headerContext) return {};
    if (typeof headerContext === "string") {
      return { headerText: headerContext };
    }
    return headerContext;
  }

  /**
   * Detects explicit scheme preference from header context against allowed schemes.
   * @param {HeaderContext} ctx
   * @param {CurriculumScheme[]} allowed
   * @returns {CurriculumScheme | null}
   */
  function disambiguateScheme(ctx, allowed) {
    if (!allowed || !allowed.length) return null;
    if (allowed.length === 1) return allowed[0];

    const txt = String(ctx.headerText || "").replace(/[–—−]/g, "-");
    const has2026Policy =
      /\bUNIFIED\s+CBME\b/i.test(txt) ||
      /\bMUHS\/X-1\/2261\/2026\b/i.test(txt) ||
      (ctx.actualExamDate && String(ctx.actualExamDate) >= "2026-08-01") ||
      (Number(ctx.examYear) >= 2026 &&
        (String(ctx.examSession || "").toUpperCase() === "WINTER" ||
          /\bWinter\s*-\s*202[6-9]\b/i.test(txt) ||
          Number(ctx.examYear) > 2026 ||
          /\bPhase\s*-\s*(?:III|IV|3|4)\b/i.test(txt)));

    if (
      ctx.curriculumScheme === "CBME_UNIFIED_2026" ||
      (has2026Policy && allowed.indexOf("CBME_UNIFIED_2026") !== -1)
    ) {
      if (allowed.indexOf("CBME_UNIFIED_2026") !== -1) return "CBME_UNIFIED_2026";
    }

    if (ctx.curriculumScheme && allowed.indexOf(ctx.curriculumScheme) !== -1) {
      return ctx.curriculumScheme;
    }

    if ((/\(\s*OLD(?:\s+SCHEME)?\s*\)/i.test(txt) || /\bOLD\s+COURSE\b/i.test(txt)) && allowed.indexOf("OLD") !== -1) {
      return "OLD";
    }
    if ((/\(\s*CBME\s*-\s*2024\s*\)/i.test(txt) || /\bCBME\s*\(\s*2024\s*\)/i.test(txt)) && allowed.indexOf("CBME_2024") !== -1) {
      return "CBME_2024";
    }
    if ((/\(\s*CBME\s*-\s*2023\s*\)/i.test(txt) || /\bCBME\s*\(\s*2023\s*\)/i.test(txt)) && allowed.indexOf("CBME_2023") !== -1) {
      return "CBME_2023";
    }
    if ((/\(\s*(?:CBME\s*-\s*)?2021\s*\)/i.test(txt) || /\bCBME\s*\(\s*2021\s*\)/i.test(txt)) && allowed.indexOf("CBME_2021_SPLIT") !== -1) {
      return "CBME_2021_SPLIT";
    }
    if ((/\(\s*(?:CBME\s*-\s*)?2019\s*\)/i.test(txt) || /\bCBME\s*\(\s*2019\s*\)/i.test(txt)) && allowed.indexOf("CBME_2019") !== -1) {
      return "CBME_2019";
    }

    return allowed[0];
  }

  /**
   * Disambiguates profYear for reused Third MBBS codes (ENT/Ophthalmology).
   * @param {HeaderContext} ctx
   * @param {ProfYear[]} allowed
   * @param {CurriculumScheme | null} resolvedScheme
   * @returns {ProfYear | null}
   */
  function disambiguateProfYear(ctx, allowed, resolvedScheme) {
    if (!allowed || !allowed.length) return null;
    if (allowed.length === 1) return allowed[0];

    const txt = String(ctx.headerText || "").replace(/[–—−]/g, "-");
    if (/(?:\bPart\s*-\s*(?:II|2)\b|\bThird\s*\(\s*II\s*\)|\bFinal\s+M\.?\s*B\.?\s*B\.?\s*S\.?\b)/i.test(txt)) {
      if (allowed.indexOf("THIRD_PART_2") !== -1) return "THIRD_PART_2";
    }
    if (/(?:\bPart\s*-\s*(?:I|1)\b|\bThird\s*\(\s*I\s*\))/i.test(txt)) {
      if (allowed.indexOf("THIRD_PART_1") !== -1) return "THIRD_PART_1";
    }
    if (ctx.profYear && allowed.indexOf(ctx.profYear) !== -1) {
      return ctx.profYear;
    }
    if (resolvedScheme === "CBME_2021_SPLIT" || resolvedScheme === "CBME_2023" || resolvedScheme === "CBME_UNIFIED_2026") {
      if (allowed.indexOf("THIRD_PART_2") !== -1) return "THIRD_PART_2";
    }
    if (resolvedScheme === "CBME_2019" || resolvedScheme === "OLD") {
      if (allowed.indexOf("THIRD_PART_1") !== -1) return "THIRD_PART_1";
    }
    return allowed[0];
  }

  /**
   * Resolves a MUHS top-right QP code deterministically against the registry,
   * using optional headerContext for cross-year / multi-scheme disambiguation,
   * or falling back to forward-compatible regex matching flagged for review.
   * @param {string | null | undefined} rawCode
   * @param {string | HeaderContext} [headerContext]
   * @returns {QpLookupResult | null}
   */
  function lookupQpCode(rawCode, headerContext) {
    const qpCode = normalizeQpCode(rawCode);
    if (!qpCode) return null;
    const ctx = normalizeContext(headerContext);
    const entry = registry.codes && registry.codes[qpCode];

    if (entry) {
      const curriculumScheme = disambiguateScheme(ctx, entry.curriculumSchemes);
      const profYear = disambiguateProfYear(ctx, entry.profYears, curriculumScheme);
      return {
        qpCode,
        rawCode: String(rawCode || ""),
        source: "registry",
        profYear,
        profYears: entry.profYears.slice(),
        subject: entry.subject,
        subjectId: resolveSubjectId(entry.subject),
        paperNumber: entry.paperNumber,
        curriculumScheme,
        curriculumSchemes: entry.curriculumSchemes.slice(),
        curriculumBucket: entry.curriculumBucket,
        requiresReview: Boolean(entry.requiresHeaderDisambiguation && !ctx.headerText && !ctx.profYear && !ctx.curriculumScheme),
        verified: entry.verified,
      };
    }

    // Forward-compatible regex fallback for future C121x / C13xx / C14xx or unlisted codes
    const yearMap = { "1": "FIRST", "2": "SECOND", "3": "THIRD_PART_1", "4": "THIRD_PART_2" };
    const cMatch = qpCode.match(/^C1([1-4])(\d{2})([AB])?$/);
    if (cMatch) {
      const yearDigit = cMatch[1];
      const subjDigits = cMatch[2];
      const suffix = cMatch[3] || "";
      /** @type {ProfYear} */
      const profYear = /** @type {ProfYear} */ (yearMap[yearDigit]);
      const paperNumber = suffix === "A" ? 1 : suffix === "B" ? 2 : null;
      const subject = (C_SERIES_FALLBACK_SUBJECTS[yearDigit] && C_SERIES_FALLBACK_SUBJECTS[yearDigit][subjDigits]) || null;
      const defaultScheme = subjDigits.startsWith("1") ? "CBME_2024" : "CBME_2023";
      const curriculumScheme = disambiguateScheme(ctx, [defaultScheme, "CBME_UNIFIED_2026"]) || defaultScheme;
      return {
        qpCode,
        rawCode: String(rawCode || ""),
        source: "regex_fallback",
        profYear,
        profYears: [profYear],
        subject,
        subjectId: resolveSubjectId(subject),
        paperNumber,
        curriculumScheme,
        curriculumSchemes: [curriculumScheme],
        curriculumBucket: "CBME",
        requiresReview: true,
        verified: false,
      };
    }

    const oldMatch = qpCode.match(/^01([1-4])(\d{2})([AB])?$/);
    if (oldMatch) {
      const profYear = /** @type {ProfYear} */ (yearMap[oldMatch[1]]);
      const paperNumber = oldMatch[3] === "A" ? 1 : oldMatch[3] === "B" ? 2 : null;
      return {
        qpCode,
        rawCode: String(rawCode || ""),
        source: "regex_fallback",
        profYear,
        profYears: [profYear],
        subject: null,
        subjectId: null,
        paperNumber,
        curriculumScheme: "OLD",
        curriculumSchemes: ["OLD"],
        curriculumBucket: "OLD",
        requiresReview: true,
        verified: false,
      };
    }

    const aabMatch = qpCode.match(/^AAB01000\d+(?:-P([12]))?$/);
    if (aabMatch) {
      const paperNumber = aabMatch[1] ? /** @type {1 | 2} */ (Number(aabMatch[1])) : null;
      return {
        qpCode,
        rawCode: String(rawCode || ""),
        source: "regex_fallback",
        profYear: ctx.profYear || null,
        profYears: [],
        subject: null,
        subjectId: null,
        paperNumber,
        curriculumScheme: disambiguateScheme(ctx, ["CBME_2019", "CBME_2021_SPLIT", "CBME_2023", "CBME_UNIFIED_2026"]),
        curriculumSchemes: ["CBME_2019", "CBME_2021_SPLIT", "CBME_2023", "CBME_UNIFIED_2026"],
        curriculumBucket: "CBME",
        requiresReview: true,
        verified: false,
      };
    }

    return null;
  }

  return {
    normalizeQpCode,
    lookupQpCode,
    resolveSubjectId,
    setRegistry,
    load,
    getRegistry: () => registry,
  };
});
