/* ==========================================================================
   MUHS Papers — application
   Vanilla JS, no build step. Papers live in IndexedDB (metadata + blobs),
   bookmarks and theme in localStorage.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Catalogue ------------------------------------------------- */
  const DATA = window.MUHS_DATA;
  const T = window.MUHS_TAXONOMY;
  const SUBJECTS = DATA.subjects;
  const PROF_YEARS = DATA.profYears || DATA.phases || Object.values(T.PROF_YEARS);
  const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s]));
  const PROF_YEAR_BY_ID = new Map(PROF_YEARS.map((p) => [p.id, p]));
  const ROMAN_PHASES = ["", "I", "II", "III", "IV", "V", "VI"];
  const CURRENT_YEAR = new Date().getFullYear();
  const FIRST_YEAR = DATA.firstYear || 2012;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const DEMO_VERSION = 2;
  const ACCEPTED_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ];
  const BOOKMARK_KEY = "muhs.bookmarks.v1";
  const THEME_KEY = "muhs.theme";
  const LAST_SUBJECT_KEY = "muhs.lastSubject";
  const SEEDED_KEY = "muhs.seeded.v1";
  const CHAI_DELAY_MS = 30000;
  const CHAI_DISMISS_KEY = "muhs.chai.dismissed.v1";
  const TELEGRAM_CHANNEL_URL = "https://t.me/muhspapersarchive";
  const APK_DOWNLOAD_URL =
    "https://github.com/muhs-papers/muhs-papers.github.io/releases/download/apk-latest/MUHS-Papers.apk";
  const APK_RELEASES_URL =
    "https://github.com/muhs-papers/muhs-papers.github.io/releases/tag/apk-latest";

  /* Edit your Buy Me a Chai popup details here (or swap upi-qr.jpg with another image). */
  const CHAI_CONFIG = {
    title: "Buy me a chai",
    subtitle: "Keep MUHS Papers brewing & 100% free",
    minBadge: "Pay minimum ₹10 · Just one cutting chai",
    description:
      "Hey there! I'm Kaustubh Kadu, a 3rd yr MBBS student at PDMMC, Amravati. I put this library together so finding past MUHS papers feels quick and stress-free before exams. If it saved you some study time, treat me to a hot cup of chai — even ₹10 keeps the archive brewing and 100% free!",
    payeeName: "Kaustubh Kadu",
    upiId: "",
    qrImageSrc: "upi-qr.jpg",
    note: "Scan with GPay, PhonePe, Paytm, or any UPI app · ₹10 minimum",
  };

  const YEARS = [];
  for (let y = CURRENT_YEAR; y >= FIRST_YEAR; y -= 1) YEARS.push(y);

  /* ---------- Tiny helpers ---------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) =>
    Array.from((root || document).querySelectorAll(sel));

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(name, cls) {
    return (
      '<svg class="icon ' +
      (cls || "") +
      '" aria-hidden="true"><use href="#i-' +
      name +
      '"></use></svg>'
    );
  }

  function telegramContributeLink(cls, label) {
    return (
      '<a class="btn ' +
      (cls || "btn-primary") +
      '" href="' +
      esc(TELEGRAM_CHANNEL_URL) +
      '" target="_blank" rel="noopener noreferrer">' +
      icon("telegram") +
      "<span>" +
      esc(label || "Contribute on Telegram") +
      "</span></a>"
    );
  }

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many || one + "s");
  }

  function formatSize(bytes) {
    if (!bytes || bytes < 1024) return (bytes || 0) + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(iso) {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(iso));
    } catch (err) {
      return "";
    }
  }

  function isoDay() {
    return new Date().toISOString().slice(0, 10);
  }

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalize(text) {
    return String(text || "").toLowerCase();
  }

  function normalizePaper(raw) {
    if (!raw || typeof raw !== "object") return raw;
    const sub = SUBJECT_BY_ID.get(raw.subjectId);
    const parsedHint = !raw.curriculumScheme && raw.rawHeaderText
      ? T.parseHeader(raw.rawHeaderText, { subjectIdHint: raw.subjectId })
      : null;
    const yearRaw = raw.examYear != null ? raw.examYear : raw.year;
    const examYear = yearRaw == null || yearRaw === "" ? null : Number(yearRaw);
    const sessRaw = String(raw.examSession || raw.session || "").toUpperCase();
    const examSession = sessRaw === "WINTER" || sessRaw === "SUMMER" ? sessRaw : null;
    const isComp = Boolean(raw.isCompilation || raw.catalogueGroup === "Multi-year collection");
    const scheme =
      raw.curriculumScheme ||
      (parsedHint && parsedHint.curriculumScheme) ||
      (isComp || (examYear && examYear <= 2020) ? "OLD" : "CBME_2019");
    const curriculumBucket = scheme === "OLD" ? "OLD" : "CBME";
    const attemptType = isComp
      ? "COMPILATION"
      : !examYear || !examSession
        ? "MODEL"
        : String(raw.attemptType || (parsedHint && parsedHint.attemptType) || (/suppl/i.test(raw.title || "") ? "SUPPLEMENTARY" : "REGULAR")).toUpperCase();
    const profYear = raw.profYear || T.applySubjectYearShift(
      T.SUBJECT_BY_ID.get(raw.subjectId),
      sub ? sub.profYear : null,
      scheme
    );
    const paperNumber = [1, 2].includes(Number(raw.paperNumber)) ? Number(raw.paperNumber) : null;
    return {
      ...raw,
      qpCode: raw.qpCode || (parsedHint && parsedHint.qpCode) || null,
      profYear,
      subject: raw.subject || (sub ? sub.name : ""),
      paperNumber,
      curriculumScheme: scheme,
      curriculumBucket,
      examSession,
      examYear,
      examPhase: raw.examPhase != null ? Number(raw.examPhase) : (parsedHint ? parsedHint.examPhase : null),
      attemptType,
      paperSection: raw.paperSection || "COMBINED",
      isCompilation: isComp,
      session: examSession ? T.formatSessionLabel(examSession) : null,
      year: examYear,
    };
  }

  function byRecency(a, b) {
    return T.comparePapersRecency(a, b);
  }

  function makeId() {
    return (
      "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }

  function profYearInfo(profYearId) {
    return PROF_YEAR_BY_ID.get(profYearId) || PROF_YEARS[0];
  }

  function subjectProfYearForBucket(subject, bucket) {
    const activeBucket = bucket || state.curriculumBucket || "CBME";
    const matching = state.papers.filter(
      (p) => p.subjectId === subject.id && (p.curriculumBucket || "CBME") === activeBucket
    );
    if (matching.length && matching[0].profYear) {
      // If ENT/Ophthalmology in CBME has mixed 2019 & 2021+, show primary profYear of most recent paper
      const latest = latestPaper(matching);
      if (latest && latest.profYear) return latest.profYear;
    }
    if (activeBucket === "OLD" && subject.oldProfYear) return subject.oldProfYear;
    return subject.profYear || "FIRST";
  }

  function subjectPhase(subject) {
    return profYearInfo(subjectProfYearForBucket(subject, state.curriculumBucket));
  }

  function papersInBucket(papers, bucket) {
    return papers.filter((p) => (p.curriculumBucket || "CBME") === bucket);
  }

  function profYearPaperCount(profYearId, bucket) {
    return state.papers.filter(
      (p) => p.profYear === profYearId && (!bucket || (p.curriculumBucket || "CBME") === bucket)
    ).length;
  }

  function papersForSubject(subjectId, bucket) {
    return state.papers.filter(
      (p) => p.subjectId === subjectId && (!bucket || (p.curriculumBucket || "CBME") === bucket)
    );
  }

  function getPaper(id) {
    return state.papers.find((p) => p.id === id);
  }

  function latestPaper(papers) {
    if (!papers.length) return null;
    return papers.slice().sort(byRecency)[0];
  }

  function partLabel(paper) {
    if (paper.paperNumber === 1) return "Paper I";
    if (paper.paperNumber === 2) return "Paper II";
    const sub = SUBJECT_BY_ID.get(paper.subjectId);
    return sub && sub.multiPaper === false ? "Single paper" : "Paper not specified";
  }

  function catalogueGroup(paper) {
    if (paper.isCompilation || paper.catalogueGroup === "Multi-year collection") {
      return "Multi-Year Compilations (OLD)";
    }
    if (paper.attemptType === "MODEL") return "CBME Model & Specimen Papers";
    return "";
  }

  function examLabel(paper) {
    if (paper.isCompilation) {
      return "Compilation" + (paper.compilationSpan ? " · " + paper.compilationSpan : "");
    }
    if (paper.attemptType === "MODEL") {
      return T.formatSchemeBadge(paper.curriculumScheme) + " Model Paper";
    }
    if (paper.session && paper.year) return paper.session + " " + paper.year;
    return catalogueGroup(paper) || T.formatSchemeBadge(paper.curriculumScheme);
  }

  function defaultTitle(paper) {
    if (paper.title && paper.title.trim()) return paper.title.trim();
    return T.formatPaperTitle(paper);
  }

  function fileExt(paper) {
    if (paper.kind === "site") return "PDF";
    if (paper.kind === "link") return "LINK";
    const type = paper.fileType || "";
    if (type.indexOf("pdf") !== -1) return "PDF";
    if (type.indexOf("image") !== -1) return "IMG";
    return "FILE";
  }

  function badgeClass(paper) {
    if (paper.kind === "link") return "link";
    return (paper.fileType || "").indexOf("image") !== -1 ? "img" : "pdf";
  }

  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function readString(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (err) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      /* Storage can be blocked; the app still works in-session. */
    }
  }

  /* ---------- Storage (IndexedDB) --------------------------------------- */
  const DB_NAME = "muhs-papers";
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not available"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("papers")) {
          db.createObjectStore("papers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Could not open DB"));
      req.onblocked = () => reject(new Error("Database upgrade blocked"));
    }).catch((err) => {
      state.storageOk = false;
      throw err;
    });
    return dbPromise;
  }

  function dbGetAll(store) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function dbGet(store, key) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function dbPut(store, value) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(value);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  function dbDelete(store, key) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  function dbClear(store) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).clear();
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  /* ---------- State ----------------------------------------------------- */
  const state = {
    papers: [],
    bookmarks: new Set(readArray(BOOKMARK_KEY).filter((x) => typeof x === "string")),
    query: "",
    profYear: "all",
    curriculumBucket: "CBME",
    filters: { part: "all", session: "all", attempt: "all", scheme: "all", year: "all" },
    route: { name: "browse", subjectId: null },
    theme: "light",
    addFile: null,
    scanResult: null,
    scanAbort: null,
    scanInFlight: false,
    lastFocus: null,
    currentObjectUrl: null,
    storageOk: true,
    loading: true,
  };

  function persistBookmarks() {
    writeStorage(BOOKMARK_KEY, JSON.stringify(Array.from(state.bookmarks)));
  }

  function persistTheme() {
    writeStorage(THEME_KEY, state.theme);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    const dark = state.theme === "dark";
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      btn.setAttribute(
        "aria-label",
        dark ? "Switch to light theme" : "Switch to dark theme"
      );
      btn.title = dark ? "Light theme" : "Dark theme";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#1d7386");
  }

  function initTheme() {
    const stored = readString(THEME_KEY);
    state.theme =
      stored === "dark" || stored === "light"
        ? stored
        : document.documentElement.dataset.theme === "dark"
          ? "dark"
          : "light";
    applyTheme();
  }

  /* ---------- Placeholder PDF (for the sample library) ------------------ */
  function pdfEscape(text) {
    return String(text)
      .replace(/[^\x20-\x7E]/g, "-")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  function makeSamplePdf(subject, session, year) {
    const parts = ["BT"];
    let y = 770;
    const put = (text, size, gap, bold) => {
      parts.push(
        "/" + (bold ? "F2" : "F1") + " " + size + " Tf",
        "1 0 0 1 64 " + y + " Tm",
        "(" + pdfEscape(text) + ") Tj"
      );
      y -= gap;
    };
    put("MUHS MBBS", 22, 26, true);
    put("Sample document - not a real question paper", 10, 40);
    y -= 18;
    put(subject.name, 17, 20, true);
    put(session + " " + year, 12, 40);
    put("This is a placeholder created by MUHS Papers so you can", 11, 16);
    put("explore the app. It does not contain real questions.", 11, 34);
    put("To replace it with the actual paper:", 11, 20, true);
    put("1. Open the paper PDF from your college or MUHS source.", 10.5, 16);
    put("2. Delete this sample entry from the subject page.", 10.5, 16);
    put("3. Add the real file under the same subject and session.", 10.5, 34);
    put("Your papers stay in this browser unless you export them.", 9, 0);
    parts.push("ET");

    const content = parts.join("\n");
    const objects = [
      null,
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> " +
        "/Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
      "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream",
    ];

    let pdf = "%PDF-1.4\n";
    const offsets = [];
    for (let i = 1; i < objects.length; i += 1) {
      offsets[i] = pdf.length;
      pdf += i + " 0 obj\n" + objects[i] + "\nendobj\n";
    }
    const xrefAt = pdf.length;
    pdf += "xref\n0 " + objects.length + "\n0000000000 65535 f \n";
    for (let i = 1; i < objects.length; i += 1) {
      pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    }
    pdf +=
      "trailer\n<< /Size " +
      objects.length +
      " /Root 1 0 R >>\nstartxref\n" +
      xrefAt +
      "\n%%EOF";
    return new Blob([pdf], { type: "application/pdf" });
  }

  /* ---------- Routing --------------------------------------------------- */
  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
    if (raw.indexOf("subject/") === 0) {
      const id = raw.slice("subject/".length);
      if (SUBJECT_BY_ID.has(id)) return { name: "subject", subjectId: id };
    }
    if (raw === "bookmarks") return { name: "bookmarks", subjectId: null };
    if (raw === "about") return { name: "about", subjectId: null };
    return { name: "browse", subjectId: null };
  }

  function routeKey(route) {
    return route.name + ":" + (route.subjectId || "");
  }

  /* ---------- Matching -------------------------------------------------- */
  function matchesAll(haystack, query) {
    if (!query) return true;
    return query.split(/\s+/).every((term) => haystack.indexOf(term) !== -1);
  }

  function paperMatches(paper, query) {
    if (!query) return true;
    const s = SUBJECT_BY_ID.get(paper.subjectId);
    const prof = PROF_YEAR_BY_ID.get(paper.profYear);
    const hay = normalize(
      [
        paper.title,
        paper.qpCode,
        paper.curriculumScheme,
        T.formatSchemeBadge(paper.curriculumScheme),
        paper.curriculumBucket,
        paper.attemptType,
        T.formatAttemptLabel(paper.attemptType),
        paper.paperSection,
        paper.examPhase ? "Phase " + ROMAN_PHASES[paper.examPhase] + " Phase " + paper.examPhase : "",
        paper.rawHeaderText,
        partLabel(paper),
        paper.session,
        paper.year,
        paper.fileName,
        s ? s.name : "",
        s ? s.code : "",
        prof ? prof.label : "",
        prof ? prof.name : "",
      ].join(" ")
    );
    return matchesAll(hay, query);
  }

  function subjectMatches(subject, query) {
    if (!query) return true;
    const prof = subjectPhase(subject);
    const hay = normalize(
      [
        subject.name,
        subject.code,
        subject.blurb,
        prof ? prof.label : "",
        prof ? prof.name : "",
        prof ? prof.tag : "",
      ].join(" ")
    );
    return matchesAll(hay, query);
  }

  /* ---------- Shared UI pieces ------------------------------------------ */
  function emptyArt() {
    return (
      '<svg class="empty-art" viewBox="0 0 150 118" fill="none" aria-hidden="true">' +
      '<rect x="24" y="20" width="64" height="82" rx="8" transform="rotate(-7 56 61)" fill="var(--surface-2)" stroke="var(--line-strong)"/>' +
      '<rect x="40" y="14" width="64" height="82" rx="8" fill="var(--surface)" stroke="var(--line-strong)"/>' +
      '<path d="M54 34h36M54 44h27M54 54h33" stroke="var(--line-strong)" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="112" cy="83" r="18" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/>' +
      '<path d="M112 74v18M103 83h18" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>' +
      "</svg>"
    );
  }

  function bookmarkButton(paper) {
    const marked = state.bookmarks.has(paper.id);
    return (
      '<button class="icon-action' +
      (marked ? " bookmarked" : "") +
      '" type="button" data-action="bookmark" data-id="' +
      esc(paper.id) +
      '" aria-pressed="' +
      marked +
      '" aria-label="' +
      (marked ? "Remove bookmark" : "Bookmark this paper") +
      '" title="' +
      (marked ? "Remove bookmark" : "Bookmark") +
      '">' +
      icon("bookmark") +
      "</button>"
    );
  }

  function paperMeta(paper, context) {
    const s = SUBJECT_BY_ID.get(paper.subjectId);
    const bits = [];
    if (paper.isCompilation) {
      bits.push(
        "Compilation" +
          (paper.compilationSpan ? " (" + esc(paper.compilationSpan) + ")" : "") +
          " · " +
          esc(T.formatSchemeBadge(paper.curriculumScheme))
      );
    } else if (paper.attemptType === "MODEL") {
      bits.push(
        "Model Paper · " + esc(T.formatSchemeBadge(paper.curriculumScheme))
      );
    } else {
      bits.push(esc(T.formatCardMetaLine(paper)));
    }
    if (paper.paperSection === "MCQ") bits.push("MCQ Sec. A");
    else if (paper.paperSection === "THEORY") bits.push("Theory");
    bits.push(partLabel(paper));
    if (context !== "subject" && s) bits.push(esc(s.name));
    if (paper.kind === "file" || paper.kind === "site") {
      bits.push(fileExt(paper) + " · " + formatSize(paper.fileSize));
    } else {
      bits.push("External link");
    }
    if (paper.qpCode) bits.push("QP " + esc(paper.qpCode));
    if (paper.examPhase) {
      bits.push(
        '<span class="wave-chip" title="MUHS exam wave (administrative schedule, not MBBS year)">Phase ' +
          esc(ROMAN_PHASES[paper.examPhase] || paper.examPhase) +
          "</span>"
      );
    }
    if (paper.demo) bits.push('<span class="demo-flag">Demo</span>');
    return bits
      .map((bit, i) => (i === 0 ? bit : '<span class="dot"></span>' + bit))
      .join("");
  }

  function driveFileId(url) {
    if (!url) return "";
    const m =
      String(url).match(/drive\.google\.com\/file\/d\/([^/?#]+)/i) ||
      String(url).match(/drive\.google\.com\/(?:open|uc)\b[^#]*[?&]id=([^&#]+)/i);
    return m ? m[1] : "";
  }

  function downloadUrlForPaper(paper) {
    if (!paper || !paper.url) return "";
    const driveId = driveFileId(paper.url);
    if (driveId) {
      return "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(driveId);
    }
    return paper.url;
  }

  // Restrict hosted paths to catalogue-owned assets, relative to the Pages subpath.
  function siteUrl(paper) {
    if (!/^papers\/[a-z]+\/[a-zA-Z0-9_-]+\.pdf$/.test(paper.url)) return "";
    const base = window.Capacitor?.isNativePlatform?.()
      ? "https://kodestien234.github.io/muhs-papers/" : document.baseURI;
    return new URL(paper.url, base).href;
  }

  function paperRow(paper, context) {
    const title = defaultTitle(paper);
    const downloadAction =
      '<button class="icon-action" type="button" data-action="download" data-id="' +
      esc(paper.id) +
      '" aria-label="Download PDF" title="Download PDF">' +
      icon("download") +
      "</button>";
    const linkAction =
      paper.kind !== "file"
        ? '<button class="icon-action" type="button" data-action="open-link" data-id="' +
          esc(paper.id) +
          '" aria-label="Open link in new tab" title="Open link">' +
          icon("external") +
          "</button>"
        : "";

    const badgeClassName = paper.isCompilation
      ? "session-comp"
      : paper.attemptType === "MODEL"
        ? "session-model"
        : paper.session
          ? "session-" + paper.session.toLowerCase()
          : "session-archive";
    const badgeLabel = paper.isCompilation
      ? "Compilation"
      : paper.attemptType === "MODEL"
        ? "Model"
        : paper.session || "Exam";

    return (
      '<article class="paper-row' +
      (paper.demo ? " is-demo" : "") +
      '">' +
      '<button class="paper-main" type="button" data-action="preview" data-id="' +
      esc(paper.id) +
      '" title="Open paper">' +
      '<span class="file-badge ' +
      badgeClass(paper) +
      '">' +
      fileExt(paper) +
      "</span>" +
      '<span class="paper-text">' +
      '<span class="paper-title">' +
      esc(title) +
      "</span>" +
      '<span class="paper-meta">' +
      paperMeta(paper, context) +
      "</span>" +
      "</span>" +
      "</button>" +
      '<span class="session ' +
      badgeClassName +
      '">' +
      esc(badgeLabel) +
      "</span>" +
      '<div class="paper-actions">' +
      bookmarkButton(paper) +
      downloadAction +
      linkAction +
      "</div>" +
      "</article>"
    );
  }

  function renderPaperGroups(papers, context, compact) {
    if (!papers.length) return "";
    const dated = papers.filter((p) => !p.isCompilation && p.attemptType !== "MODEL" && p.year);
    const models = papers.filter((p) => p.attemptType === "MODEL");
    const compilations = papers.filter((p) => p.isCompilation);
    const groups = new Map();
    dated.slice().sort(byRecency).forEach((p) => {
      const key = p.year;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    if (models.length) {
      groups.set("CBME Model & Specimen Papers", models.slice().sort(byRecency));
    }
    if (compilations.length) {
      groups.set("Multi-Year Compilations (2000–2019)", compilations.slice().sort(byRecency));
    }
    const sections = [];
    groups.forEach((list, year) => {
      sections.push(
        '<section class="year-group" aria-label="' +
          year +
          ' papers">' +
          '<div class="year-head"><h3>' +
          year +
          '</h3><span class="rule"></span><span class="count">' +
          plural(list.length, "paper", "papers") +
          "</span></div>" +
          '<div class="paper-list">' +
          list.map((p) => paperRow(p, context)).join("") +
          "</div></section>"
      );
    });
    return (
      '<div class="paper-groups' +
      (compact ? " compact" : "") +
      '">' +
      sections.join("") +
      "</div>"
    );
  }

  function subjectCard(subject, bucket) {
    const papers = papersForSubject(subject.id, bucket);
    const count = papers.length;
    const pyId = subjectProfYearForBucket(subject, bucket);
    const pyDef = profYearInfo(pyId);
    return (
      '<a class="subject-card phase-' +
      esc(pyDef.legacyPhase || subject.phase) +
      '" href="#/subject/' +
      subject.id +
      '">' +
      '<div class="sc-top">' +
      '<span class="monogram" aria-hidden="true"><svg class="subject-art" viewBox="0 0 32 32" focusable="false"><use href="subject-icons.svg#' +
      esc(subject.id) +
      '"></use></svg></span>' +
      '<span class="count-pill' +
      (count ? " has" : "") +
      '">' +
      (count ? plural(count, "paper", "papers") : "No papers") +
      "</span>" +
      "</div>" +
      "<h3>" +
      esc(subject.name) +
      "</h3>" +
      '<span class="subject-next" aria-hidden="true">' + icon("arrow-right") + "</span>" +
      "</a>"
    );
  }

  function subjectGrid(subjects, bucket) {
    return (
      '<div class="subject-grid">' +
      subjects.map((s) => subjectCard(s, bucket)).join("") +
      "</div>"
    );
  }

  function renderCurriculumTabs(papers, isSubjectContext) {
    const cbmeCount = papersInBucket(papers, "CBME").length;
    const oldCount = papersInBucket(papers, "OLD").length;
    const active = state.curriculumBucket || "CBME";
    const tabs = [
      { id: "CBME", label: "CBME", count: cbmeCount },
      { id: "OLD", label: "OLD (Pre-2019)", count: oldCount },
    ];
    return (
      '<div class="curriculum-tabs' +
      (isSubjectContext ? " subject-curriculum" : "") +
      '" role="tablist" aria-label="Curriculum scheme">' +
      tabs
        .map(
          (tab) =>
            '<button class="curriculum-tab" type="button" role="tab" aria-selected="' +
            (active === tab.id) +
            '" data-action="bucket" data-bucket="' +
            tab.id +
            '">' +
            tab.label +
            '<span class="n">' +
            tab.count +
            "</span></button>"
        )
        .join("") +
      "</div>"
    );
  }

  function renderPhaseTabs() {
    const tabs = [{ id: "all", label: "All Prof years" }].concat(
      PROF_YEARS.map((p) => ({ id: p.id, label: p.label }))
    );
    return (
      '<div class="phase-tabs" role="tablist" aria-label="Filter by Prof year">' +
      tabs
        .map((tab) => {
          const selected = state.profYear === tab.id;
          return (
            '<button class="phase-tab" type="button" role="tab" aria-selected="' +
            selected +
            '" data-action="prof-year" data-prof-year="' +
            tab.id +
            '">' +
            tab.label +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function isStandaloneApp() {
    return (
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      Boolean(window.navigator.standalone)
    );
  }

  function renderHero() {
    const installRow = isStandaloneApp()
      ? ""
      : '<div class="hero-install-row">' +
        '<button class="btn btn-sm hero-install-btn" type="button" data-action="install-app">' +
        icon("install") +
        "<span>Install Web App</span></button>" +
        '<a class="btn btn-ghost btn-sm hero-apk-btn" href="' +
        esc(APK_DOWNLOAD_URL) +
        '" target="_blank" rel="noopener noreferrer">' +
        icon("download") +
        "<span>Download Android APK</span></a>" +
        "</div>";
    return (
      '<section class="paper-intro">' +
      '<div class="hero-copy">' +
      '<p class="intro-label">MUHS / MBBS</p><h1>Previous year papers</h1>' +
      '<p>Select a Prof year and subject to find papers sorted by exam cycle, attempt and curriculum.</p>' +
      '<small>' + SUBJECTS.length + ' subjects <span>·</span> ' + PROF_YEARS.length + ' Prof years</small>' +
      installRow +
      '</div>' +
      '<svg class="intro-art" aria-hidden="true" viewBox="0 0 240 155" fill="none"><circle cx="134" cy="82" r="68" fill="#62c8df" opacity=".13"/><g stroke="#62c8df" stroke-width="2"><rect x="88" y="19" width="87" height="116" rx="7" transform="rotate(12 88 19)" fill="#244451"/><rect x="76" y="25" width="87" height="116" rx="7" transform="rotate(-7 76 25)" fill="#14313d"/><path d="M95 51l22-3m-21 16 49-6m-47 19 49-6m-48 19 35-4"/><path d="M152 112h18l5-9 8 20 7-14h20" stroke-width="3" stroke-linejoin="round"/></g></svg>' +
      "</section>"
    );
  }

  /* ---------- Browse view ----------------------------------------------- */
  function renderBrowseView() {
    const query = normalize(state.query.trim());
    const total = state.papers.length;
    const activeBucket = state.curriculumBucket || "CBME";
    const parts = query ? [] : [renderHero()];

    if (!state.storageOk) {
      parts.push(
        '<div class="callout"><span class="callout-icon">' +
          icon("alert") +
          '</span><div class="callout-text"><h3>Browser storage is unavailable</h3><p>Papers you add now can\'t be saved. Open this app through the local server (<code>npm start</code>) or a hosted URL and try again.</p></div></div>'
      );
    }

    if (query) {
      const paperHits = state.papers
        .filter((p) => paperMatches(p, query))
        .sort(byRecency);
      const subjectHits = SUBJECTS.filter((s) => subjectMatches(s, query));
      const summary =
        plural(paperHits.length, "paper", "papers") +
        " · " +
        plural(subjectHits.length, "subject", "subjects");

      parts.push(
        '<div class="results-block"><div class="results-head"><h2>Search results</h2><span>' +
          esc(summary) +
          "</span></div>"
      );
      if (!paperHits.length && !subjectHits.length) {
        parts.push(
          '<div class="search-empty"><strong>Nothing matches “' +
            esc(state.query.trim()) +
            '”</strong><p>Try a subject name, QP code like C1101A, exam year like 2024, or CBME / OLD.</p><button class="btn btn-ghost btn-sm" type="button" data-action="clear-search">Clear search</button></div>'
        );
      } else {
        if (paperHits.length) {
          parts.push(
            '<div class="results-block"><div class="results-head"><h2>Papers</h2><span>' +
              plural(paperHits.length, "match", "matches") +
              "</span></div>" +
              renderPaperGroups(paperHits, "all", true) +
              "</div>"
          );
        }
        if (subjectHits.length) {
          parts.push(
            '<div class="results-block"><div class="results-head"><h2>Subjects</h2><span>' +
              plural(subjectHits.length, "subject", "subjects") +
              "</span></div>" +
              subjectGrid(subjectHits) +
              "</div>"
          );
        }
      }
      parts.push("</div>");
      return parts.join("");
    }

    const chaiButton =
      '<button class="btn browse-chai" id="browse-chai" type="button" data-action="open-chai" aria-label="Buy me a chai — minimum 10 rupees">' +
      '<svg class="browse-chai-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<path class="chai-steam-line l1" d="M9 5c0-1.3 1.1-2.2 1.1-3.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      '<path class="chai-steam-line l2" d="M13.5 5c0-1.3 1.1-2.2 1.1-3.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      '<path d="M4 9.5h12v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-5Z" fill="#d97706" fill-opacity="0.28" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>' +
      '<path d="M16 11h2a2.4 2.4 0 0 1 0 4.8h-2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      '<path d="M4 21h12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>' +
      "</svg>" +
      '<span class="browse-chai-label">Buy me a chai</span>' +
      '<span class="browse-chai-short">Buy a chai</span>' +
      '<span class="browse-chai-tag">₹10+</span>' +
      "</button>";

    parts.push(
      '<div class="library-head"><div class="section-title browse-title-row"><h2>Browse subjects</h2></div>' +
        '<div class="browse-controls">' +
        renderCurriculumTabs(state.papers, false) +
        chaiButton +
        renderPhaseTabs() +
        "</div></div>"
    );

    if (!total) {
      parts.push(
        '<div class="callout"><span class="callout-icon">' +
          icon("sparkle") +
          '</span><div class="callout-text"><h3>No papers saved yet</h3><p>Contribute missing papers on Telegram or try the library with sample PDFs.</p></div><div class="callout-actions">' +
          telegramContributeLink("btn-primary btn-sm", "Contribute on Telegram") +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="load-demo">Load sample library</button></div></div>'
      );
    }

    const yearsToShow =
      state.profYear === "all"
        ? PROF_YEARS
        : PROF_YEARS.filter((p) => p.id === state.profYear);

    yearsToShow.forEach((py) => {
      const subjects = SUBJECTS.filter((s) => subjectProfYearForBucket(s, activeBucket) === py.id);
      if (!subjects.length) return;
      const bhalaniActions = py.bhalani
        ? '<div class="phase-actions">' +
          '<button class="btn btn-ghost btn-sm phase-bhalani-btn" type="button" data-action="view-bhalani" data-prof-year="' +
          esc(py.id) +
          '" aria-label="View and download ' +
          esc(py.bhalani.title) +
          '" title="View & download ' +
          esc(py.bhalani.title) +
          '">' +
          icon("file") +
          "<span>Bhalani PDF</span></button>" +
          "</div>"
        : "";
      parts.push(
        '<section class="phase-section phase-' +
          esc(py.legacyPhase) +
          '">' +
          '<div class="phase-head"><span class="phase-kicker">' +
          esc(py.tag) +
          "</span><h3>" +
          esc(py.label) +
          "</h3><p>" +
          esc(py.desc) +
          '</p><span class="phase-count">' +
          plural(subjects.length, "subject", "subjects") +
          " · " +
          plural(profYearPaperCount(py.id, activeBucket), "paper", "papers") +
          "</span>" +
          bhalaniActions +
          "</div>" +
          subjectGrid(subjects, activeBucket) +
          "</section>"
      );
    });

    return parts.join("");
  }

  /* ---------- Subject view ---------------------------------------------- */
  function renderSubjectView(subjectId) {
    const subject = SUBJECT_BY_ID.get(subjectId);
    if (!subject) return renderNotFound();

    const activeBucket = state.curriculumBucket || "CBME";
    const allSubjectPapers = papersForSubject(subject.id);
    const bucketPapers = papersInBucket(allSubjectPapers, activeBucket);
    const otherBucket = activeBucket === "CBME" ? "OLD" : "CBME";
    const otherCount = papersInBucket(allSubjectPapers, otherBucket).length;

    const py = profYearInfo(subjectProfYearForBucket(subject, activeBucket));
    const latest = latestPaper(bucketPapers.length ? bucketPapers : allSubjectPapers);
    const yearsPresent = Array.from(new Set(bucketPapers.map((p) => p.year).filter(Boolean))).sort(
      (a, b) => b - a
    );
    const schemesPresent = Array.from(new Set(bucketPapers.map((p) => p.curriculumScheme).filter(Boolean)));
    const attemptsPresent = Array.from(new Set(bucketPapers.map((p) => p.attemptType).filter(Boolean)));

    if (
      state.filters.year !== "all" &&
      yearsPresent.indexOf(Number(state.filters.year)) === -1
    ) {
      state.filters.year = "all";
    }
    if (state.filters.part === "0" && !bucketPapers.some((p) => !p.paperNumber)) {
      state.filters.part = "all";
    }
    if (state.filters.scheme !== "all" && schemesPresent.indexOf(state.filters.scheme) === -1) {
      state.filters.scheme = "all";
    }
    if (state.filters.attempt !== "all" && attemptsPresent.indexOf(state.filters.attempt) === -1) {
      state.filters.attempt = "all";
    }
    const query = normalize(state.query.trim());

    let list = bucketPapers.filter((p) => paperMatches(p, query));
    if (state.filters.part !== "all") {
      list = list.filter((p) => (p.paperNumber || 0) === Number(state.filters.part));
    }
    if (state.filters.session !== "all") {
      list = list.filter((p) => p.session === state.filters.session);
    }
    if (state.filters.attempt !== "all") {
      list = list.filter((p) => p.attemptType === state.filters.attempt);
    }
    if (state.filters.scheme !== "all") {
      list = list.filter((p) => p.curriculumScheme === state.filters.scheme);
    }
    if (state.filters.year !== "all") {
      list = list.filter((p) => p.year === Number(state.filters.year));
    }
    list.sort(byRecency);

    const filtersActive =
      state.filters.part !== "all" ||
      state.filters.session !== "all" ||
      state.filters.attempt !== "all" ||
      state.filters.scheme !== "all" ||
      state.filters.year !== "all" ||
      !!query;

    const partChoices = subject.multiPaper === false
      ? [["all", "All parts"], ["0", "Single paper"]]
      : [["all", "Both papers"], ["1", "Paper I"], ["2", "Paper II"]].concat(
          bucketPapers.some((p) => !p.paperNumber) ? [["0", "Single paper"]] : []
        );

    const sessionOptions = ["all", "Summer", "Winter"]
      .map(
        (value) =>
          '<option value="' +
          value +
          '"' +
          (state.filters.session === value ? " selected" : "") +
          ">" +
          (value === "all" ? "All sessions" : value) +
          "</option>"
      )
      .join("");

    const attemptOptions = [{ id: "all", label: "All attempts" }]
      .concat(
        attemptsPresent.map((a) => ({
          id: a,
          label:
            a === "SUPPLEMENTARY"
              ? "Supplementary"
              : a === "MODEL"
                ? "Model Paper"
                : a === "COMPILATION"
                  ? "Compilation"
                  : "Regular",
        }))
      )
      .map(
        (opt) =>
          '<option value="' +
          opt.id +
          '"' +
          (state.filters.attempt === opt.id ? " selected" : "") +
          ">" +
          esc(opt.label) +
          "</option>"
      )
      .join("");

    const schemeOptions = [{ id: "all", label: "All schemes" }]
      .concat(schemesPresent.map((sc) => ({ id: sc, label: T.formatSchemeBadge(sc) })))
      .map(
        (opt) =>
          '<option value="' +
          opt.id +
          '"' +
          (state.filters.scheme === opt.id ? " selected" : "") +
          ">" +
          esc(opt.label) +
          "</option>"
      )
      .join("");

    const yearOptions = ['<option value="all">All years</option>']
      .concat(
        yearsPresent.map(
          (year) =>
            '<option value="' +
            year +
            '"' +
            (String(state.filters.year) === String(year) ? " selected" : "") +
            ">" +
            year +
            "</option>"
        )
      )
      .join("");

    const metaChips =
      '<span class="meta-chip">' +
      icon("layers") +
      esc(py.label) +
      "</span>" +
      '<span class="meta-chip">' +
      icon("file") +
      plural(bucketPapers.length, activeBucket + " paper", activeBucket + " papers") +
      "</span>" +
      (latest && latest.year
        ? '<span class="meta-chip">' +
          icon("calendar") +
          "Latest " +
          esc(latest.session) +
          " " +
          latest.year +
          "</span>"
        : "");

    const parts = [
      '<div class="subject-hero">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Browse</a><span class="sep">/</span><span>' +
        esc(py.label) +
        '</span><span class="sep">/</span><span aria-current="page">' +
        esc(subject.name) +
        "</span></nav>" +
        '<div class="subject-head phase-' +
        esc(py.legacyPhase || subject.phase) +
        '">' +
        '<span class="monogram">' +
        esc(subject.code) +
        "</span>" +
        '<div class="subject-head-main"><h1>' +
        esc(subject.name) +
        '</h1><p class="blurb">' +
        esc(subject.blurb) +
        '</p><div class="subject-meta">' +
        metaChips +
        "</div></div>" +
        '<div class="subject-actions">' +
        telegramContributeLink("btn-primary", "Contribute on Telegram") +
        "</div>" +
        "</div>" +
        renderCurriculumTabs(allSubjectPapers, true) +
        "</div>",
    ];

    {
      parts.push(
        '<div class="filters"><span class="filters-label">Filter</span>' +
          '<div class="select"><select id="filter-part" aria-label="Filter by paper number">' +
          partChoices
            .map(([v, label]) => '<option value="' + v + '"' + (state.filters.part === v ? " selected" : "") + ">" + label + "</option>")
            .join("") +
          "</select>" + icon("chevron-down") + "</div>" +
          '<div class="select"><select id="filter-session" aria-label="Filter by exam session">' +
          sessionOptions +
          "</select>" +
          icon("chevron-down") +
          "</div>" +
          (attemptsPresent.length > 1
            ? '<div class="select"><select id="filter-attempt" aria-label="Filter by attempt type">' +
              attemptOptions +
              "</select>" +
              icon("chevron-down") +
              "</div>"
            : "") +
          (schemesPresent.length > 1
            ? '<div class="select"><select id="filter-scheme" aria-label="Filter by curriculum scheme">' +
              schemeOptions +
              "</select>" +
              icon("chevron-down") +
              "</div>"
            : "") +
          (yearsPresent.length
            ? '<div class="select"><select id="filter-year" aria-label="Filter by exam year">' +
              yearOptions +
              "</select>" +
              icon("chevron-down") +
              "</div>"
            : "") +
          (filtersActive
            ? '<button class="clear-filters" type="button" data-action="clear-filters">Clear</button>'
            : "") +
          '<span class="results-count">' +
          plural(list.length, "paper", "papers") +
          (query ? " matching your search" : "") +
          "</span></div>"
      );
    }

    if (!bucketPapers.length) {
      parts.push(
        '<div class="empty">' +
          emptyArt() +
          "<h3>No " +
          esc(activeBucket) +
          " papers for " +
          esc(subject.name) +
          " yet</h3><p>" +
          (otherCount
            ? esc(plural(otherCount, otherBucket + " paper", otherBucket + " papers")) +
              " available under the " +
              esc(otherBucket) +
              " tab."
            : "Have this paper? Share it on our Telegram channel to help crowdsource the archive.") +
          "</p>" +
          '<div class="empty-actions">' +
          (otherCount
            ? '<button class="btn btn-primary" type="button" data-action="bucket" data-bucket="' +
              otherBucket +
              '">View ' +
              esc(otherBucket) +
              " papers</button>"
            : "") +
          telegramContributeLink(otherCount ? "btn-ghost" : "btn-primary", "Contribute on Telegram") +
          (!allSubjectPapers.length && !state.papers.some((p) => p.demo)
            ? '<button class="btn btn-ghost" type="button" data-action="load-demo">Load sample library</button>'
            : "") +
          "</div>" +
          "</div>"
      );
    } else if (!list.length) {
      parts.push(
        '<div class="empty"><h3>No papers match these filters</h3><p>Try a different paper number, session, attempt or year, or clear the filters to see all ' +
          plural(bucketPapers.length, activeBucket + " paper", activeBucket + " papers") +
          ' for this subject.</p><div class="empty-actions">' +
          telegramContributeLink("btn-primary", "Contribute on Telegram") +
          '<button class="btn btn-ghost" type="button" data-action="clear-filters">Clear filters</button></div></div>'
      );
    } else {
      parts.push(renderPaperGroups(list, "subject"));
    }

    return parts.join("");
  }

  function renderNotFound() {
    return (
      '<div class="about"><p class="eyebrow">Not found</p><h1>That shelf is empty.</h1><p class="lede">We couldn\'t find this subject. It may have been renamed or removed from the catalogue.</p><a class="btn btn-primary" href="#/">Back to the library</a></div>'
    );
  }

  /* ---------- Bookmarks view -------------------------------------------- */
  function renderBookmarksView() {
    const query = normalize(state.query.trim());
    const allBookmarked = state.papers.filter((p) => state.bookmarks.has(p.id));
    const list = allBookmarked
      .filter((p) => paperMatches(p, query))
      .sort(byRecency);

    const parts = [
      '<div class="subject-hero">' +
        '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Browse</a><span class="sep">/</span><span aria-current="page">Bookmarks</span></nav>' +
        '<div class="subject-head"><div class="subject-head-main"><p class="eyebrow">Saved for later</p><h1>Bookmarks</h1><p class="blurb">The papers you want within reach the week before exams.</p><div class="subject-meta"><span class="meta-chip">' +
        icon("bookmark") +
        plural(list.length, "paper", "papers") +
        (query ? " matching your search" : "") +
        "</span></div></div>" +
        '<div class="subject-actions"><a class="btn btn-ghost" href="#/">Browse library</a></div></div>' +
        "</div>",
    ];

    if (!allBookmarked.length) {
      parts.push(
        '<div class="empty">' +
          emptyArt() +
          "<h3>No bookmarks yet</h3><p>Tap the bookmark icon on any paper and it will show up here, ready for revision week.</p>" +
          '<div class="empty-actions"><a class="btn btn-primary" href="#/">Browse the library</a></div></div>'
      );
    } else if (!list.length) {
      parts.push(
        '<div class="empty"><h3>No bookmarks match “' +
          esc(state.query.trim()) +
          '”</h3><p>Try a subject name, year or session — or clear the search to see all saved papers.</p><div class="empty-actions"><button class="btn btn-ghost" type="button" data-action="clear-search">Clear search</button></div></div>'
      );
    } else {
      parts.push(renderPaperGroups(list, "all"));
    }
    return parts.join("");
  }

  /* ---------- About view ------------------------------------------------ */
  function renderAboutView() {
    const demoCount = state.papers.filter((p) => p.demo).length;
    const total = state.papers.length;
    return `<div class="about">
      <p class="eyebrow">About this project</p>
      <h1>A quiet home for past papers.</h1>
      <p class="lede">MUHS Papers is a small, local-first library for MBBS previous year question papers. It keeps the university's exam structure — four Prof years, CBME and OLD curriculum schemes, Summer and Winter sessions — as the backbone, so a paper is always one search away.</p>

      <div class="info-grid">
        <div class="info-tile">${icon("shield")}<h3>Local-first</h3><p>Files are stored in your browser's IndexedDB. Nothing is uploaded to a server.</p></div>
        <div class="info-tile">${icon("calendar")}<h3>Session-aware</h3><p>Papers are filed by Prof year, curriculum scheme, exam session and attempt — never trusted blindly from filenames.</p></div>
        <div class="info-tile">${icon("folder")}<h3>Backup &amp; share</h3><p>Export your library as one JSON file, then import it on another device or send it to a classmate.</p></div>
      </div>

      <div class="about-card">
        <h2>How papers are organised</h2>
        <p>The catalogue follows the MUHS MBBS Professional Year taxonomy: <strong>First MBBS</strong> (Anatomy, Physiology, Biochemistry); <strong>Second MBBS</strong> (Pathology, Pharmacology, Microbiology, plus OLD-scheme Forensic Medicine); <strong>Third MBBS · Part I</strong> (Community Medicine, CBME Forensic Medicine, plus OLD/CBME-2019 ENT &amp; Ophthalmology); and <strong>Final MBBS · Part II</strong> (General Medicine, General Surgery, Paediatrics, Obstetrics &amp; Gynaecology, plus CBME 2021+ ENT &amp; Ophthalmology).</p>
        <p><strong>CBME</strong> schemes appear first with <strong>OLD (Pre-2019)</strong> separated cleanly, and each card shows its official MUHS cycle (<strong>Summer</strong> / <strong>Winter</strong>), attempt (<strong>Regular</strong> / <strong>Suppl.</strong>), and scheme badge while keeping scheduling waves (<strong>Phase I–VI</strong>) in secondary metadata.</p>
      </div>

      <div class="about-card">
        <h2>Where the papers come from</h2>
        <p>From MBBS students like you. Have missing or recent MUHS question papers? Share them on our Telegram channel so everyone benefits.</p>
        <ol class="steps">
          <li>Join our <a href="${TELEGRAM_CHANNEL_URL}" target="_blank" rel="noopener noreferrer"><strong>Telegram channel</strong></a>.</li>
          <li>Send PDFs or photos of missing MUHS question papers.</li>
          <li>Use <strong>Export backup</strong> below to save your bookmarks and local notes.</li>
        </ol>
      </div>

      <div class="about-card">
        <h2>Backup &amp; transfer</h2>
        <p>Exported backups include the PDFs themselves, encoded inside the JSON file. That makes the backup large, but it means one file is enough to move your whole library.</p>
        <div class="data-actions">
          <button class="btn btn-primary" type="button" data-action="export" ${total ? "" : "disabled"}>${icon("download")} Export backup</button>
          <button class="btn btn-ghost" type="button" data-action="import">${icon("upload")} Import backup</button>
          ${demoCount ? `<button class="btn btn-quiet" type="button" data-action="remove-demo">Remove ${demoCount} sample papers</button>` : ""}
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </div>
        ${total ? `<div class="danger-line"><p>${plural(total, "paper", "papers")} stored in this browser.</p><button class="btn btn-danger btn-sm" type="button" data-action="reset">Clear library</button></div>` : ""}
      </div>

      <div class="about-card">
        <h2>Privacy</h2>
        <p>There is no account, no analytics and no server. Your library lives in this browser profile. Clearing site data will remove it, so keep a backup of papers you care about.</p>
      </div>

      <div class="about-card">
        <h2>Disclaimer</h2>
        <p>MUHS Papers is an independent study tool and is not affiliated with Maharashtra University of Health Sciences. Always cross-check papers, syllabus and exam schedules with the <a href="https://www.muhs.ac.in/" target="_blank" rel="noopener noreferrer">official MUHS website</a> and your college.</p>
        <p class="about-footnote">Version 1.0 · Built for MUHS MBBS students · Your library, your browser.</p>
      </div>
    </div>`;
  }

  /* ---------- Render ---------------------------------------------------- */
  function render(options) {
    const opts = options || {};
    let html;
    if (state.route.name === "subject") {
      html = renderSubjectView(state.route.subjectId);
    } else if (state.route.name === "bookmarks") {
      html = renderBookmarksView();
    } else if (state.route.name === "about") {
      html = renderAboutView();
    } else {
      html = renderBrowseView();
    }
    const view = document.getElementById("view");
    view.innerHTML = opts.animate
      ? '<div class="view-enter">' + html + "</div>"
      : html;
    syncChrome();
  }

  function syncChrome() {
    $$("[data-nav]").forEach((link) => {
      const name = link.dataset.nav;
      if (name === state.route.name) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const badge = document.getElementById("bookmark-count");
    if (badge) {
      badge.textContent = String(state.bookmarks.size);
      badge.hidden = state.bookmarks.size === 0;
    }

    const input = document.getElementById("search-input");
    if (input) {
      if (input.value !== state.query) input.value = state.query;
      const subject =
        state.route.name === "subject"
          ? SUBJECT_BY_ID.get(state.route.subjectId)
          : null;
      input.placeholder =
        state.route.name === "bookmarks"
          ? "Search bookmarks…"
          : subject
            ? "Search " + subject.name + "…"
            : "Search subjects, papers, years…";
      const searchWrap = input.closest(".search");
      if (searchWrap) searchWrap.hidden = state.route.name === "about";
    }

    const titles = {
      browse: "MUHS Papers — MBBS previous year question papers",
      bookmarks: "Bookmarks — MUHS Papers",
      about: "About — MUHS Papers",
    };
    if (state.route.name === "subject") {
      const subject = SUBJECT_BY_ID.get(state.route.subjectId);
      document.title = subject
        ? subject.name + " papers — MUHS Papers"
        : titles.browse;
    } else {
      document.title = titles[state.route.name] || titles.browse;
    }
  }

  /* ---------- Toast ----------------------------------------------------- */
  function toast(message, options) {
    const opts = options || {};
    const root = document.getElementById("toast-root");
    if (!root) return;
    root.innerHTML = "";
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML =
      '<span class="toast-icon">' +
      icon(opts.error ? "alert" : "check") +
      "</span><span>" +
      esc(message) +
      "</span>" +
      (opts.action ? "<button type=\"button\">" + esc(opts.action.label) + "</button>" : "");
    root.appendChild(el);

    let timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      el.remove();
    }
    if (opts.action) {
      const btn = el.querySelector("button");
      btn.addEventListener("click", () => {
        dismiss();
        opts.action.onClick();
      });
    }
    timer = setTimeout(dismiss, opts.timeout || (opts.action ? 7000 : 3200));
  }

  /* ---------- Modal plumbing -------------------------------------------- */
  function openModal(html) {
    const root = document.getElementById("modal-root");
    const savedFocus =
      root && root.innerHTML ? state.lastFocus : document.activeElement;
    closeModal(true);
    state.lastFocus = savedFocus;
    root.innerHTML = html;
    document.body.classList.add("modal-open");
    const modal = root.querySelector(".modal");
    requestAnimationFrame(() => {
      const target =
        root.querySelector("[data-autofocus]") ||
        root.querySelector(".modal-close") ||
        modal;
      if (target && target.focus) target.focus({ preventScroll: true });
    });
  }

  function closeModal(immediate) {
    const root = document.getElementById("modal-root");
    if (!root || !root.innerHTML) return;
    if (!immediate && root.querySelector(".chai-modal")) {
      writeStorage(CHAI_DISMISS_KEY, "1");
    }
    if (state.scanAbort) {
      state.scanAbort.abort();
      state.scanAbort = null;
    }
    state.scanInFlight = false;
    state.scanResult = null;
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    if (state.currentObjectUrl) {
      URL.revokeObjectURL(state.currentObjectUrl);
      state.currentObjectUrl = null;
    }
    let focusTarget = state.lastFocus;
    if (
      focusTarget &&
      !document.contains(focusTarget) &&
      focusTarget.dataset &&
      focusTarget.dataset.action === "preview" &&
      focusTarget.dataset.id
    ) {
      focusTarget = $$('[data-action="preview"]').find(
        (el) => el.dataset.id === focusTarget.dataset.id
      );
    }
    if (
      !immediate &&
      focusTarget &&
      typeof focusTarget.focus === "function" &&
      document.contains(focusTarget)
    ) {
      focusTarget.focus({ preventScroll: true });
    }
    state.lastFocus = null;
  }

  function trapFocus(event) {
    const modal = document.querySelector(".modal");
    if (!modal) return;
    const items = $$(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      modal
    ).filter((el) => el.offsetParent !== null);
    if (!items.length) {
      event.preventDefault();
      modal.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------- Buy me a chai popup --------------------------------------- */
  let chaiTimerId = null;

  const CHAI_CUP_ART =
    '<svg class="chai-art" viewBox="0 0 88 88" width="64" height="64" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
    '<linearGradient id="chaiTea" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#e59a4c"/><stop offset="100%" stop-color="#a8531b"/>' +
    '</linearGradient>' +
    '<linearGradient id="chaiCup" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#fffaf2"/><stop offset="100%" stop-color="#f2dfd0"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<path class="chai-steam s1" d="M31 24c-3-4-2-9 2-13s2-8 0-10" fill="none" stroke="#d9822b" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path class="chai-steam s2" d="M44 22c-3-4-2-10 2-14s2-7 0-9" fill="none" stroke="#c86b20" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path class="chai-steam s3" d="M57 24c-3-4-2-9 2-13s2-8 0-10" fill="none" stroke="#d9822b" stroke-width="2.6" stroke-linecap="round"/>' +
    '<ellipse cx="44" cy="72" rx="30" ry="6.5" fill="#e7d6c5" stroke="#b97745" stroke-width="2"/>' +
    '<path d="M62 39h6.5a7.5 7.5 0 0 1 0 15H61" fill="none" stroke="#b97745" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M22 33h42v17a21 21 0 0 1-21 21 21 21 0 0 1-21-21V33Z" fill="url(#chaiCup)" stroke="#b97745" stroke-width="2.4"/>' +
    '<ellipse cx="43" cy="33" rx="21" ry="6" fill="#fffdf9" stroke="#b97745" stroke-width="2.2"/>' +
    '<ellipse cx="43" cy="33.5" rx="17" ry="4.1" fill="url(#chaiTea)"/>' +
    '<path d="M35 33.2c4-1.3 12-1.3 16 0" fill="none" stroke="#ffe7c2" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>' +
    '<circle cx="43" cy="51" r="4" fill="#d9822b" opacity="0.22"/>' +
    '</svg>';

  const CHAI_CUP_MINI =
    '<svg class="chai-mini-svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M9 4c0-1.2 1-2 1-3M14 4c0-1.2 1-2 1-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M4 9h12v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V9Z" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M16 10.5h2a2.5 2.5 0 0 1 0 5h-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M4 21h12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
    '</svg>';

  function openChaiModal() {
    const upiButton = CHAI_CONFIG.upiId
      ? '<button class="chai-upi-btn" type="button" data-action="copy-upi">UPI ID: ' +
        esc(CHAI_CONFIG.upiId) +
        "</button>"
      : "";

    const html =
      '<div class="modal-backdrop" data-close-modal>' +
      '<div class="modal chai-modal" id="chai-dialog" role="dialog" aria-modal="true" aria-labelledby="chai-title">' +
      '<div class="modal-head chai-head">' +
      '<div class="chai-head-main">' +
      '<div class="chai-art-badge">' +
      CHAI_CUP_ART +
      "</div>" +
      '<div><h2 id="chai-title">' +
      esc(CHAI_CONFIG.title) +
      '</h2><p class="chai-subtitle">' +
      esc(CHAI_CONFIG.subtitle) +
      "</p></div></div>" +
      '<button class="icon-btn modal-close" type="button" data-close-modal aria-label="Close">' +
      icon("close") +
      "</button></div>" +
      '<div class="modal-body chai-body">' +
      '<div class="chai-min-pill" id="chai-min-pill">' +
      CHAI_CUP_MINI +
      "<span>" +
      esc(CHAI_CONFIG.minBadge) +
      "</span></div>" +
      '<p class="chai-desc" id="chai-description">' +
      esc(CHAI_CONFIG.description) +
      "</p>" +
      '<div class="chai-qr-card">' +
      '<img class="chai-qr-img" id="chai-qr-img" src="' +
      esc(CHAI_CONFIG.qrImageSrc) +
      '" alt="UPI QR code for ' +
      esc(CHAI_CONFIG.payeeName) +
      '" width="220" height="220">' +
      '<strong class="chai-payee-name" id="chai-payee-name">' +
      esc(CHAI_CONFIG.payeeName) +
      "</strong>" +
      upiButton +
      '<small class="chai-note">' +
      esc(CHAI_CONFIG.note) +
      "</small></div></div>" +
      '<div class="modal-foot">' +
      '<button class="btn btn-quiet" type="button" data-close-modal>Maybe later</button>' +
      '<button class="btn btn-primary" type="button" data-action="chai-done" data-autofocus>Sent a chai!</button>' +
      "</div></div></div>";

    openModal(html);
  }

  function scheduleChaiPopup() {
    if (chaiTimerId || readString(CHAI_DISMISS_KEY) === "1") return;
    const tryShow = () => {
      chaiTimerId = null;
      if (readString(CHAI_DISMISS_KEY) === "1") return;
      if (document.body.classList.contains("modal-open") || document.visibilityState === "hidden") {
        chaiTimerId = setTimeout(tryShow, 3000);
        return;
      }
      openChaiModal();
    };
    chaiTimerId = setTimeout(tryShow, CHAI_DELAY_MS);
  }

  /* ---------- Add-paper modal ------------------------------------------- */
  function subjectSelectOptions(selectedId) {
    const activeBucket = state.curriculumBucket || "CBME";
    return PROF_YEARS.map((py) => {
      const options = SUBJECTS.filter((s) => subjectProfYearForBucket(s, activeBucket) === py.id)
        .map(
          (s) =>
            '<option value="' +
            s.id +
            '"' +
            (s.id === selectedId ? " selected" : "") +
            ">" +
            esc(s.name) +
            "</option>"
        )
        .join("");
      return (
        '<optgroup label="' +
        esc(py.label + " — " + py.name) +
        '">' +
        options +
        "</optgroup>"
      );
    }).join("");
  }

  function openAddModal(subjectId) {
    const remembered = readString(LAST_SUBJECT_KEY);
    const fallback =
      state.route.name === "subject"
        ? state.route.subjectId
        : SUBJECT_BY_ID.has(remembered)
          ? remembered
          : SUBJECTS[0].id;
    const selected =
      subjectId && SUBJECT_BY_ID.has(subjectId) ? subjectId : fallback;
    const now = new Date();
    const defaultSession = now.getMonth() >= 6 ? "Winter" : "Summer";
    state.addFile = null;
    if (state.scanAbort) {
      state.scanAbort.abort();
      state.scanAbort = null;
    }
    state.scanInFlight = false;
    state.scanResult = null;

    const yearOptions = YEARS.map(
      (y) =>
        '<option value="' +
        y +
        '"' +
        (y === CURRENT_YEAR ? " selected" : "") +
        ">" +
        y +
        "</option>"
    ).join("");

    const html =
      '<div class="modal-backdrop" data-close-modal>' +
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-title">' +
      '<div class="modal-head"><div><h2 id="add-title">Add a paper</h2><p>Drop a PDF or image to auto-scan subject, year, paper &amp; duplicates.</p></div>' +
      '<button class="icon-btn modal-close" type="button" data-close-modal aria-label="Close">' +
      icon("close") +
      "</button></div>" +
      '<form id="add-form" novalidate><div class="modal-body"><div class="form-grid">' +
      '<div class="field"><span class="label">Source</span><div class="seg" role="radiogroup" aria-label="Paper source">' +
      '<label><input type="radio" name="source" value="file" checked><span>Upload file</span></label>' +
      '<label><input type="radio" name="source" value="link"><span>Paste link</span></label></div></div>' +
      '<div class="field" id="source-file"><label class="dropzone" id="dropzone" for="f-file">' +
      '<input type="file" id="f-file" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" hidden>' +
      '<span class="dz-icon">' +
      icon("upload") +
      "</span><strong>Drop a PDF here, or click to browse</strong>" +
      "<small>PDF, JPG, PNG or WEBP · up to 20 MB · auto-scans content</small></label>" +
      '<div id="file-preview"></div>' +
      '<div class="scan-status" id="scan-status" role="status" aria-live="polite" hidden></div></div>' +
      '<div class="field" id="source-link" hidden><label for="f-url">Paper link</label>' +
      '<input class="input" type="url" id="f-url" name="url" placeholder="https://…" inputmode="url" autocomplete="off">' +
      '<span class="hint">Google Drive, college website or any direct PDF link.</span></div>' +
      '<div class="field"><label for="f-subject">Subject</label><select class="input" id="f-subject" name="subject" data-autofocus>' +
      subjectSelectOptions(selected) +
      "</select></div>" +
      '<div class="field"><span class="label">Paper number</span><div class="seg" role="radiogroup" aria-label="Paper number">' +
      [
        [1, "Paper 1"],
        [2, "Paper 2"],
        ["", "Single paper"],
      ]
        .map(([v, lbl]) => {
          const isSingleSubj = SUBJECT_BY_ID.get(selected)?.multiPaper === false;
          const checked =
            v === ""
              ? isSingleSubj
              : !isSingleSubj && Number(v) === (state.filters.part === "2" ? 2 : 1);
          return '<label><input type="radio" name="paperNumber" value="' + v + '"' + (checked ? " checked" : "") + "><span>" + lbl + "</span></label>";
        })
        .join("") +
      '</div></div>' +
      '<div class="form-row">' +
      '<div class="field"><span class="label">Exam session</span><div class="seg" role="radiogroup" aria-label="Exam session">' +
      '<label><input type="radio" name="session" value="Summer"' +
      (defaultSession === "Summer" ? " checked" : "") +
      "><span>Summer</span></label>" +
      '<label><input type="radio" name="session" value="Winter"' +
      (defaultSession === "Winter" ? " checked" : "") +
      '><span>Winter</span></label></div></div>' +
      '<div class="field"><label for="f-year">Exam year</label><select class="input" id="f-year" name="year">' +
      yearOptions +
      "</select></div></div>" +
      '<div class="form-row">' +
      '<div class="field"><label for="f-scheme">Curriculum scheme</label><select class="input" id="f-scheme" name="curriculumScheme">' +
      [
        ["CBME_2024", "CBME 2024"],
        ["CBME_2023", "CBME 2023"],
        ["CBME_2021_SPLIT", "CBME 2021"],
        ["CBME_2019", "CBME 2019"],
        ["CBME_UNIFIED_2026", "CBME Unified 2026"],
        ["OLD", "OLD (Pre-2019)"],
      ]
        .map(([val, lbl]) => '<option value="' + val + '"' + (val === "CBME_2023" ? " selected" : "") + ">" + lbl + "</option>")
        .join("") +
      "</select></div>" +
      '<div class="field"><label for="f-attempt">Attempt type</label><select class="input" id="f-attempt" name="attemptType">' +
      '<option value="REGULAR" selected>Regular</option>' +
      '<option value="SUPPLEMENTARY">Supplementary</option>' +
      '<option value="MODEL">Model / Specimen</option>' +
      "</select></div></div>" +
      '<div class="form-row">' +
      '<div class="field"><label for="f-qpcode">QP Code <span class="optional">optional</span></label>' +
      '<input class="input" id="f-qpcode" name="qpCode" maxlength="32" placeholder="e.g. C1101A" autocomplete="off"></div>' +
      '<div class="field"><label for="f-wave">Exam wave <span class="optional">optional</span></label><select class="input" id="f-wave" name="examPhase">' +
      '<option value="">Not specified</option>' +
      [1, 2, 3, 4, 5, 6]
        .map((n) => '<option value="' + n + '">Phase ' + ROMAN_PHASES[n] + "</option>")
        .join("") +
      "</select></div></div>" +
      '<div class="field"><label for="f-title">Title <span class="optional">optional</span></label>' +
      '<input class="input" id="f-title" name="title" maxlength="180" placeholder="Auto-filled from PDF header or generated" autocomplete="off">' +
      '<span class="hint">Derived from printed MUHS header (never filenames).</span></div>' +
      '<p class="form-error" id="add-error" role="alert" hidden>' +
      icon("alert") +
      "<span></span></p>" +
      "</div></div>" +
      '<div class="modal-foot"><button class="btn btn-quiet" type="button" data-close-modal>Cancel</button>' +
      '<button class="btn btn-primary" type="submit" id="add-submit">Add paper</button></div>' +
      "</form></div></div>";

    openModal(html);
    bindAddForm();
  }

  function showAddError(message) {
    const box = document.getElementById("add-error");
    if (!box) return;
    if (!message) {
      box.hidden = true;
      const span = box.querySelector("span");
      if (span) span.textContent = "";
      return;
    }
    box.hidden = false;
    const span = box.querySelector("span");
    if (span) span.textContent = message;
  }

  function setScanStatus(mode, message) {
    const box = document.getElementById("scan-status");
    if (!box) return;
    if (!message) {
      box.hidden = true;
      box.className = "scan-status";
      box.textContent = "";
      return;
    }
    box.hidden = false;
    box.className = "scan-status scan-" + (mode || "scanning");
    box.textContent = message;
  }

  function setAddSubmitState(disabled, label) {
    const submit = document.getElementById("add-submit");
    if (!submit) return;
    submit.disabled = Boolean(disabled);
    submit.textContent = label || "Add paper";
  }

  function fileTypeOf(file) {
    if (file.type) return file.type;
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    return "";
  }

  function buildCandidateFromForm(form, idOverride) {
    const data = new FormData(form);
    const subjectId = String(data.get("subject") || "");
    const subject = SUBJECT_BY_ID.get(subjectId);
    const session = String(data.get("session") || "");
    const rawPart = String(data.get("paperNumber") || "");
    const paperNumber = rawPart === "1" || rawPart === "2" ? Number(rawPart) : null;
    const year = parseInt(data.get("year"), 10);
    const title = String(data.get("title") || "").trim().slice(0, 180);
    const rawQpCode = String(data.get("qpCode") || "").trim().toUpperCase().slice(0, 32) || null;
    const curriculumScheme = String(data.get("curriculumScheme") || "CBME_2023");
    const attemptRaw = String(data.get("attemptType") || "REGULAR");
    const attemptType =
      attemptRaw === "SUPPLEMENTARY"
        ? "SUPPLEMENTARY"
        : attemptRaw === "MODEL"
          ? "MODEL"
          : "REGULAR";
    const waveRaw = String(data.get("examPhase") || "");
    const examPhase = waveRaw ? Number(waveRaw) : null;
    const source = String(data.get("source") || "file");
    const rawUrl = String(data.get("url") || "").trim();
    const scan = source === "file" ? state.scanResult : null;
    const file = source === "file" ? state.addFile : null;
    const scannedProfYear =
      scan && scan.parsed && scan.parsed.subjectId === subjectId ? scan.parsed.profYear : null;
    const profYear = T.applySubjectYearShift(
      T.SUBJECT_BY_ID.get(subjectId),
      scannedProfYear || (subject ? subject.profYear : null),
      curriculumScheme
    );

    return {
      source,
      rawUrl,
      subject,
      candidate: normalizePaper({
        id: idOverride || "candidate",
        subjectId,
        subject: subject ? subject.name : "",
        profYear,
        qpCode: rawQpCode,
        curriculumScheme,
        attemptType,
        examPhase,
        paperNumber,
        paperSection: scan && scan.paperSection ? scan.paperSection : "COMBINED",
        session,
        year: Number.isFinite(year) ? year : null,
        title,
        fileSha256: scan && scan.fileSha256 ? scan.fileSha256 : null,
        rawHeaderText: scan && scan.rawHeaderText ? scan.rawHeaderText : null,
        inferredCohortHint: file && file.name ? file.name : null,
        kind: file ? "file" : "link",
        addedAt: new Date().toISOString(),
        demo: false,
      }),
    };
  }

  function findDuplicateInState(candidate) {
    if (window.MUHS_PDF_SCANNER && typeof window.MUHS_PDF_SCANNER.findDuplicatePaper === "function") {
      return window.MUHS_PDF_SCANNER.findDuplicatePaper(candidate, state.papers);
    }
    const hit = state.papers.find((existing) => T.isSamePaperRecord(existing, candidate));
    return hit ? { existing: hit, reason: "taxonomy" } : null;
  }

  function refreshAddDuplicateCheck() {
    const form = document.getElementById("add-form");
    if (!form || state.scanInFlight) return null;
    const built = buildCandidateFromForm(form);
    if (built.source !== "file" || !state.addFile) {
      const dupLink = built.source === "link" && built.candidate.subjectId && built.candidate.examYear
        ? findDuplicateInState(built.candidate)
        : null;
      if (dupLink) {
        const dupLabel = defaultTitle(dupLink.existing) + " (" + examLabel(dupLink.existing) + ")";
        showAddError("Duplicate paper rejected: \"" + dupLabel + "\" already exists in the database.");
        setAddSubmitState(true, "Duplicate rejected");
        return dupLink;
      }
      showAddError("");
      setAddSubmitState(false, "Add paper");
      return null;
    }

    const dup = findDuplicateInState(built.candidate);
    if (dup) {
      const dupLabel = defaultTitle(dup.existing) + " (" + examLabel(dup.existing) + ")";
      const prefix = dup.reason === "exact-file"
        ? "Duplicate PDF rejected (identical file already stored): "
        : "Duplicate paper rejected (already in database): ";
      setScanStatus("duplicate", prefix + dupLabel);
      showAddError(prefix + dupLabel);
      setAddSubmitState(true, "Duplicate rejected");
      return dup;
    }

    showAddError("");
    setAddSubmitState(false, "Add paper");
    return null;
  }

  function ensureSelectOption(select, value, label) {
    if (!select) return;
    const strVal = String(value);
    const hasOpt = Array.from(select.options).some((opt) => opt.value === strVal);
    if (!hasOpt) {
      const opt = document.createElement("option");
      opt.value = strVal;
      opt.textContent = label || strVal;
      select.appendChild(opt);
    }
    select.value = strVal;
  }

  function applyScanResultToForm(scanRes) {
    const form = document.getElementById("add-form");
    if (!form || !scanRes || !scanRes.parsed) return;
    const p = scanRes.parsed;

    const subjSel = document.getElementById("f-subject");
    if (subjSel && p.subjectId && SUBJECT_BY_ID.has(p.subjectId)) {
      subjSel.value = p.subjectId;
    }
    const activeSubjId = subjSel ? subjSel.value : p.subjectId;
    const isSingle = SUBJECT_BY_ID.get(activeSubjId)?.multiPaper === false;
    const desiredPart = isSingle
      ? ""
      : p.paperNumber === 1 || p.paperNumber === 2
        ? String(p.paperNumber)
        : null;
    if (desiredPart !== null) {
      const radio = form.querySelector('input[name="paperNumber"][value="' + desiredPart + '"]');
      if (radio) radio.checked = true;
    }

    if (p.examSession === "SUMMER" || p.examSession === "WINTER") {
      const sessVal = p.examSession === "SUMMER" ? "Summer" : "Winter";
      const sessRadio = form.querySelector('input[name="session"][value="' + sessVal + '"]');
      if (sessRadio) sessRadio.checked = true;
    }

    const yearSel = document.getElementById("f-year");
    if (yearSel && p.examYear) {
      ensureSelectOption(yearSel, p.examYear, String(p.examYear));
    }

    const schemeSel = document.getElementById("f-scheme");
    if (schemeSel && p.curriculumScheme) {
      ensureSelectOption(schemeSel, p.curriculumScheme, T.formatSchemeBadge(p.curriculumScheme));
    }

    const attemptSel = document.getElementById("f-attempt");
    if (attemptSel && p.attemptType) {
      attemptSel.value =
        p.attemptType === "SUPPLEMENTARY"
          ? "SUPPLEMENTARY"
          : p.attemptType === "MODEL"
            ? "MODEL"
            : "REGULAR";
    }

    const qpInput = document.getElementById("f-qpcode");
    if (qpInput && p.qpCode) {
      qpInput.value = p.qpCode;
    }

    const waveSel = document.getElementById("f-wave");
    if (waveSel) {
      waveSel.value = p.examPhase >= 1 && p.examPhase <= 6 ? String(p.examPhase) : "";
    }

    const titleInput = document.getElementById("f-title");
    if (titleInput && scanRes.suggestedTitle) {
      titleInput.value = scanRes.suggestedTitle;
    }
  }

  async function runAddFileScan(file) {
    if (!window.MUHS_PDF_SCANNER || typeof window.MUHS_PDF_SCANNER.scanPaperFile !== "function") {
      return;
    }
    if (state.scanAbort) state.scanAbort.abort();
    const ctrl = new AbortController();
    state.scanAbort = ctrl;
    state.scanInFlight = true;
    state.scanResult = null;
    setAddSubmitState(true, "Scanning…");
    setScanStatus("scanning", "Preparing PDF scanner…");

    try {
      const res = await window.MUHS_PDF_SCANNER.scanPaperFile(file, {
        signal: ctrl.signal,
        onProgress: (info) => {
          if (ctrl.signal.aborted) return;
          setScanStatus("scanning", (info && info.message) || "Scanning paper…");
        },
      });
      if (ctrl.signal.aborted || state.addFile !== file || !res) return;

      state.scanInFlight = false;
      state.scanResult = res;
      applyScanResultToForm(res);

      const dup = refreshAddDuplicateCheck();
      if (dup) return;

      const p = res.parsed || {};
      const parts = [];
      if (p.subject) parts.push(p.subject);
      if (p.paperNumber) parts.push("Paper " + (p.paperNumber === 1 ? "I" : "II"));
      if (p.examSession && p.examYear) parts.push(T.formatSessionLabel(p.examSession) + " " + p.examYear);
      if (p.curriculumScheme) parts.push(T.formatSchemeBadge(p.curriculumScheme));
      if (p.examPhase) parts.push("Phase " + (ROMAN_PHASES[p.examPhase] || p.examPhase));
      if (p.qpCode) parts.push("QP " + p.qpCode);

      if (p.subjectId && p.examSession && p.examYear) {
        setScanStatus(
          "detected",
          "Auto-detected" + (res.ocrUsed ? " via OCR" : "") + ": " + parts.join(" · ") + " — ready to add."
        );
      } else {
        setScanStatus(
          "warning",
          "Scan complete (" +
            (res.ocrUsed ? "OCR" : "text") +
            (parts.length ? ": " + parts.join(" · ") : "") +
            "). Verify any missing fields before adding."
        );
      }
    } catch (err) {
      if (ctrl.signal.aborted || state.addFile !== file) return;
      state.scanInFlight = false;
      state.scanResult = null;
      setScanStatus("warning", "Automatic scan could not read text from this file — verify fields manually.");
      setAddSubmitState(false, "Add paper");
    }
  }

  function acceptAddFile(file) {
    if (!file) return;
    const type = fileTypeOf(file);
    if (ACCEPTED_TYPES.indexOf(type) === -1) {
      showAddError("That file type is not supported. Choose a PDF, JPG, PNG or WEBP.");
      state.addFile = null;
      updateAddFilePreview();
      setScanStatus("", "");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showAddError("That file is larger than 20 MB. Compress the PDF and try again.");
      return;
    }
    state.addFile = file;
    showAddError("");
    updateAddFilePreview();
    runAddFileScan(file);
  }

  function updateAddFilePreview() {
    const wrap = document.getElementById("file-preview");
    const dz = document.getElementById("dropzone");
    if (!wrap) return;
    if (!state.addFile) {
      wrap.innerHTML = "";
      if (dz) dz.hidden = false;
      return;
    }
    if (dz) dz.hidden = true;
    const file = state.addFile;
    const ext = (file.name.split(".").pop() || "file").toUpperCase();
    wrap.innerHTML =
      '<div class="file-chip"><span class="file-chip-icon">' +
      esc(ext.slice(0, 4)) +
      '</span><span class="file-chip-text"><strong>' +
      esc(file.name) +
      "</strong><small>" +
      formatSize(file.size) +
      '</small></span><button class="icon-btn" type="button" data-action="clear-file" aria-label="Remove selected file">' +
      icon("close") +
      "</button></div>";
  }

  function clearAddFile() {
    if (state.scanAbort) {
      state.scanAbort.abort();
      state.scanAbort = null;
    }
    state.scanInFlight = false;
    state.scanResult = null;
    state.addFile = null;
    const input = document.getElementById("f-file");
    if (input) input.value = "";
    updateAddFilePreview();
    setScanStatus("", "");
    showAddError("");
    setAddSubmitState(false, "Add paper");
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.href;
      }
    } catch (err) {
      return "";
    }
    return "";
  }

  function bindAddForm() {
    const form = document.getElementById("add-form");
    if (!form) return;
    const fileInput = document.getElementById("f-file");
    const dropzone = document.getElementById("dropzone");
    const qpInput = document.getElementById("f-qpcode");

    if (qpInput && window.MUHS_SUBJECT_CODES) {
      qpInput.addEventListener("change", () => {
        const hit = window.MUHS_SUBJECT_CODES.lookupQpCode(qpInput.value);
        if (hit) {
          qpInput.value = hit.qpCode;
          const subjSel = document.getElementById("f-subject");
          if (subjSel && hit.subjectId && SUBJECT_BY_ID.has(hit.subjectId)) subjSel.value = hit.subjectId;
          const schSel = document.getElementById("f-scheme");
          if (schSel && hit.curriculumScheme) ensureSelectOption(schSel, hit.curriculumScheme, T.formatSchemeBadge(hit.curriculumScheme));
          const partVal = hit.paperNumber === 1 || hit.paperNumber === 2 ? String(hit.paperNumber) : "";
          const partRadio = form.querySelector('input[name="paperNumber"][value="' + partVal + '"]');
          if (partRadio) partRadio.checked = true;
        }
        refreshAddDuplicateCheck();
      });
    }

    ["#f-subject", "#f-year", "#f-scheme", "#f-attempt", "#f-wave"].forEach((sel) => {
      const el = form.querySelector(sel);
      if (el) el.addEventListener("change", () => refreshAddDuplicateCheck());
    });
    form.querySelectorAll('input[name="paperNumber"], input[name="session"]').forEach((radio) => {
      radio.addEventListener("change", () => refreshAddDuplicateCheck());
    });

    form.querySelectorAll('input[name="source"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const isFile =
          form.querySelector('input[name="source"]:checked').value === "file";
        document.getElementById("source-file").hidden = !isFile;
        document.getElementById("source-link").hidden = isFile;
        if (!isFile && state.scanAbort) {
          state.scanAbort.abort();
          state.scanInFlight = false;
        }
        refreshAddDuplicateCheck();
      });
    });

    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (file) acceptAddFile(file);
      });
    }

    if (dropzone) {
      ["dragenter", "dragover"].forEach((ev) => {
        dropzone.addEventListener(ev, (event) => {
          event.preventDefault();
          dropzone.classList.add("dragover");
        });
      });
      ["dragleave", "dragend"].forEach((ev) => {
        dropzone.addEventListener(ev, (event) => {
          event.preventDefault();
          dropzone.classList.remove("dragover");
        });
      });
      dropzone.addEventListener("drop", (event) => {
        event.preventDefault();
        dropzone.classList.remove("dragover");
        const file =
          event.dataTransfer && event.dataTransfer.files
            ? event.dataTransfer.files[0]
            : null;
        if (file) acceptAddFile(file);
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.scanInFlight) {
        showAddError("Please wait for the PDF scan to finish before adding.");
        return;
      }
      showAddError("");

      const id = makeId();
      const built = buildCandidateFromForm(form, id);
      const { subject, source, rawUrl, candidate } = built;

      if (!subject) {
        showAddError("Choose a subject for this paper.");
        return;
      }
      if (candidate.attemptType !== "MODEL" && candidate.session !== "Summer" && candidate.session !== "Winter") {
        showAddError("Choose an exam session.");
        return;
      }
      if (candidate.attemptType !== "MODEL" && (!Number.isFinite(candidate.examYear) || candidate.examYear < 1990 || candidate.examYear > CURRENT_YEAR + 1)) {
        showAddError("Choose a valid exam year.");
        return;
      }

      let url = "";
      let file = source === "file" ? state.addFile : null;
      if (source === "link") {
        url = safeUrl(rawUrl);
        if (!url) {
          showAddError("Paste a valid http:// or https:// link, or switch to Upload file.");
          return;
        }
        file = null;
      } else if (!file) {
        showAddError("Choose a PDF or image to upload, or switch to Paste link.");
        return;
      }

      const dup = refreshAddDuplicateCheck();
      if (dup) return;

      setAddSubmitState(true, "Adding…");

      const meta = candidate;
      if (file) {
        meta.fileName = file.name;
        meta.fileType = fileTypeOf(file);
        meta.fileSize = file.size;
      } else {
        meta.url = url;
      }

      try {
        await dbPut("papers", meta);
        if (file) {
          try {
            await dbPut("files", { id: id, blob: file });
          } catch (fileError) {
            await dbDelete("papers", id);
            throw fileError;
          }
        }
      } catch (err) {
        showAddError(
          "Could not save this paper. Browser storage may be full or blocked — try a smaller file or a link instead."
        );
        setAddSubmitState(false, "Add paper");
        return;
      }

      state.papers.push(meta);
      state.addFile = null;
      state.scanResult = null;
      state.curriculumBucket = meta.curriculumBucket || state.curriculumBucket;
      writeStorage(LAST_SUBJECT_KEY, meta.subjectId);
      closeModal();
      render();
      toast("Added to " + subject.name);
    });
  }

  /* ---------- Paper preview --------------------------------------------- */
  function openPreview(id) {
    const paper = getPaper(id);
    if (!paper) return;
    const subject = SUBJECT_BY_ID.get(paper.subjectId);
    const phase = subject ? subjectPhase(subject) : null;
    const title = defaultTitle(paper);
    let src = paper.kind === "site" ? siteUrl(paper) : paper.url || "";
    let objectUrl = null;
    const isImage =
      paper.kind === "file" &&
      ((paper.fileType || "").indexOf("image/") === 0 ||
        /\.(png|jpe?g|webp|gif)$/i.test(paper.fileName || ""));

    function build() {
      const frameSrc =
        paper.kind !== "link" && !isImage ? src + "#view=FitH" : src;
      const media = isImage
        ? '<img src="' + esc(src) + '" alt="' + esc(title) + '">'
        : '<iframe src="' +
          esc(frameSrc) +
          '" title="' +
          esc(title) +
          '" allowfullscreen></iframe>';
      const note =
        paper.kind === "link"
          ? '<div class="preview-note">' +
            icon("info") +
            "<span>Some sites block embedding. <a href=\"" +
            esc(src) +
            '" target="_blank" rel="noopener noreferrer">Open in a new tab</a> if nothing loads.</span></div>'
          : "";
      const headMeta = [
        PROF_YEAR_BY_ID.get(paper.profYear)?.label || "",
        subject ? subject.name : "",
        partLabel(paper),
        paper.isCompilation
          ? "Compilation" + (paper.compilationSpan ? " (" + paper.compilationSpan + ")" : "")
          : paper.attemptType === "MODEL"
            ? "Model Paper · " + T.formatSchemeBadge(paper.curriculumScheme)
            : T.formatCardMetaLine(paper),
        paper.qpCode ? "QP " + paper.qpCode : "",
        paper.examPhase ? "Phase " + (ROMAN_PHASES[paper.examPhase] || paper.examPhase) : "",
      ]
        .filter(Boolean)
        .map(esc)
        .join(" · ");
      const footMeta = [
        paper.kind !== "link" ? fileExt(paper) + " · " + formatSize(paper.fileSize) : "External link",
        "Added " + formatDate(paper.addedAt),
      ]
        .map(esc)
        .join(" · ");

      return (
        '<div class="modal-backdrop" data-close-modal><div class="modal preview" role="dialog" aria-modal="true" aria-label="' +
        esc(title) +
        '">' +
        '<div class="preview-head"><div class="preview-head-main"><h2>' +
        esc(title) +
        '</h2><p id="preview-meta">' +
        headMeta +
        '</p></div><div class="actions">' +
        bookmarkButton(paper) +
        '<a class="btn btn-ghost btn-sm" href="' +
        esc(src) +
        '" target="_blank" rel="noopener noreferrer" aria-label="Open paper in a new tab" title="Open paper in a new tab">' +
        icon("external") +
        '<span>Open</span></a>' +
        '<button class="icon-btn modal-close" type="button" data-close-modal aria-label="Close preview">' +
        icon("close") +
        "</button></div></div>" +
        '<div class="preview-body">' +
        media +
        note +
        "</div>" +
        '<div class="preview-foot"><span>' +
        footMeta +
        ' · <select aria-label="Change paper number" data-edit-part="' + esc(id) + '">' +
        (!paper.paperNumber ? '<option value="">Set paper number</option>' : '') +
        [1,2].map(n => '<option value="' + n + '"' + (paper.paperNumber === n ? " selected" : "") + '>Paper ' + n + '</option>').join("") +
        '</select>' +
        '</span><div class="foot-actions">' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="download" data-id="' +
        esc(paper.id) +
        '">' +
        icon("download") +
        " Download</button>" +
        '<a class="btn btn-primary btn-sm" href="' +
        esc(src) +
        '" target="_blank" rel="noopener noreferrer">' +
        icon("external") +
        " Open in new tab</a></div></div>" +
        "</div></div>"
      );
    }

    if (paper.kind === "file") {
      dbGet("files", paper.id)
        .then((record) => {
          if (!record || !record.blob) {
            toast("The stored file is missing. Try adding this paper again.", {
              error: true,
            });
            return;
          }
          objectUrl = URL.createObjectURL(record.blob);
          src = objectUrl;
          openModal(build());
          state.currentObjectUrl = objectUrl;
        })
        .catch(() => {
          toast("Could not open this file from browser storage.", {
            error: true,
          });
        });
    } else {
      if (!src) {
        toast("This paper has no file or link attached.", { error: true });
        return;
      }
      openModal(build());
    }
  }

  function openBhalaniPreview(profYearId) {
    const py = PROF_YEAR_BY_ID.get(profYearId);
    const bhalani = py && py.bhalani;
    if (!bhalani || !bhalani.url) {
      toast("Bhalani PDF is not available for this year.", { error: true });
      return;
    }
    const src = bhalani.url;
    const frameSrc = src + "#view=FitH";
    const headMeta = [
      py.label,
      py.name,
      bhalani.pages ? bhalani.pages + " pages" : "",
      bhalani.fileSize ? "PDF · " + formatSize(bhalani.fileSize) : "",
    ]
      .filter(Boolean)
      .map(esc)
      .join(" · ");

    const html =
      '<div class="modal-backdrop" data-close-modal><div class="modal preview" role="dialog" aria-modal="true" aria-label="' +
      esc(bhalani.title) +
      '">' +
      '<div class="preview-head"><div class="preview-head-main"><h2>' +
      esc(bhalani.title) +
      '</h2><p id="preview-meta">' +
      headMeta +
      '</p></div><div class="actions">' +
      '<a class="btn btn-ghost btn-sm" href="' +
      esc(src) +
      '" target="_blank" rel="noopener noreferrer" aria-label="Open PDF in a new tab" title="Open PDF in a new tab">' +
      icon("external") +
      '<span>Open</span></a>' +
      '<button class="icon-btn modal-close" type="button" data-close-modal aria-label="Close preview">' +
      icon("close") +
      "</button></div></div>" +
      '<div class="preview-body">' +
      '<iframe src="' +
      esc(frameSrc) +
      '" title="' +
      esc(bhalani.title) +
      '" allowfullscreen></iframe>' +
      "</div>" +
      '<div class="preview-foot"><span>' +
      esc(bhalani.fileName) +
      '</span><div class="foot-actions">' +
      '<a class="btn btn-ghost btn-sm" href="' +
      esc(src) +
      '" download="' +
      esc(bhalani.fileName) +
      '">' +
      icon("download") +
      " Download</a>" +
      '<a class="btn btn-primary btn-sm" href="' +
      esc(src) +
      '" target="_blank" rel="noopener noreferrer">' +
      icon("external") +
      " Open in new tab</a></div></div>" +
      "</div></div>";

    openModal(html);
  }

  /* ---------- Demo library ---------------------------------------------- */
  function buildDemoEntries() {
    const y1 = CURRENT_YEAR - 1;
    const y2 = CURRENT_YEAR - 2;
    const y3 = CURRENT_YEAR - 3;
    return [
      { subjectId: "anatomy", session: "Summer", year: y2 },
      { subjectId: "anatomy", session: "Winter", year: y2 },
      { subjectId: "physiology", session: "Summer", year: y1 },
      { subjectId: "biochemistry", session: "Winter", year: y1 },
      { subjectId: "pathology", session: "Summer", year: y2 },
      { subjectId: "pharmacology", session: "Winter", year: y2 },
      { subjectId: "microbiology", session: "Summer", year: y3 },
      { subjectId: "forensic", session: "Winter", year: y3 },
      { subjectId: "ent", session: "Summer", year: y1 },
      { subjectId: "ophthalmology", session: "Winter", year: y1 },
      { subjectId: "community", session: "Summer", year: y2 },
      { subjectId: "medicine", session: "Winter", year: y1 },
      { subjectId: "surgery", session: "Summer", year: y1 },
      { subjectId: "pediatrics", session: "Winter", year: y2 },
      { subjectId: "obgyn", session: "Summer", year: y2 },
      { subjectId: "orthopedics", session: "Winter", year: y3 },
    ];
  }

  async function loadDemo() {
    const existing = state.papers.filter((p) => p.demo);
    if (
      existing.length &&
      existing.every((p) => p.demoVersion === DEMO_VERSION)
    ) {
      toast("Sample papers are already in your library.");
      return;
    }
    if (existing.length) {
      for (const paper of existing) {
        try {
          await dbDelete("papers", paper.id);
          await dbDelete("files", paper.id);
        } catch (err) {
          /* regenerate what we can */
        }
      }
      state.papers = state.papers.filter((p) => !p.demo);
    }
    const entries = buildDemoEntries();
    let added = 0;
    for (const entry of entries) {
      const subject = SUBJECT_BY_ID.get(entry.subjectId);
      if (!subject) continue;
      const id =
        "demo_" +
        entry.subjectId +
        "_" +
        entry.session.toLowerCase() +
        "_" +
        entry.year;
      if (getPaper(id)) continue;
      const blob = makeSamplePdf(subject, entry.session, entry.year);
      const meta = {
        id: id,
         subjectId: entry.subjectId,
         paperNumber: entries.indexOf(entry) % 2 + 1,
        session: entry.session,
        year: entry.year,
        title: "",
        kind: "file",
        fileName:
          "sample-" +
          entry.subjectId +
          "-" +
          entry.session.toLowerCase() +
          "-" +
          entry.year +
          ".pdf",
        fileType: "application/pdf",
        fileSize: blob.size,
        addedAt: new Date().toISOString(),
        demo: true,
        demoVersion: DEMO_VERSION,
      };
      try {
        await dbPut("papers", meta);
        try {
          await dbPut("files", { id: id, blob: blob });
        } catch (fileError) {
          await dbDelete("papers", id);
          throw fileError;
        }
        state.papers.push(meta);
        added += 1;
      } catch (err) {
        toast("Could not add sample papers. Browser storage may be blocked.", {
          error: true,
        });
        break;
      }
    }
    pruneBookmarks();
    render();
    if (added) {
      toast("Loaded " + plural(added, "sample paper", "sample papers"));
    }
  }

  async function removeDemoPapers() {
    const demos = state.papers.filter((p) => p.demo);
    if (!demos.length) return;
    for (const paper of demos) {
      try {
        await dbDelete("papers", paper.id);
        await dbDelete("files", paper.id);
      } catch (err) {
        /* keep going; render reflects what remains */
      }
    }
    state.papers = state.papers.filter((p) => !p.demo);
    pruneBookmarks();
    render();
    toast("Removed " + plural(demos.length, "sample paper", "sample papers"));
  }

  /* ---------- Paper actions --------------------------------------------- */
  function toggleBookmark(id, button) {
    const paper = getPaper(id);
    if (!paper) return;
    const wasMarked = state.bookmarks.has(id);
    if (wasMarked) state.bookmarks.delete(id);
    else state.bookmarks.add(id);
    persistBookmarks();
    render();
    if (button && document.contains(button)) {
      const marked = state.bookmarks.has(id);
      button.classList.toggle("bookmarked", marked);
      button.setAttribute("aria-pressed", String(marked));
      button.setAttribute(
        "aria-label",
        marked ? "Remove bookmark" : "Bookmark this paper"
      );
      button.title = marked ? "Remove bookmark" : "Bookmark";
    }
    toast(wasMarked ? "Bookmark removed" : "Bookmarked");
  }

  async function downloadPaper(id) {
    const paper = getPaper(id);
    if (!paper) return;
    const subject = SUBJECT_BY_ID.get(paper.subjectId);
    const fallbackName =
      slug(subject ? subject.name : "paper") +
      "-" +
      (paper.session || "model").toLowerCase() +
      (paper.year ? "-" + paper.year : "") +
      (paper.paperNumber ? "-paper-" + paper.paperNumber : "");

    if (paper.kind === "link" || paper.kind === "site") {
      const dlUrl = paper.kind === "site" ? siteUrl(paper) : downloadUrlForPaper(paper);
      if (!dlUrl) {
        toast("This paper has no link attached.", { error: true });
        return;
      }
      const link = document.createElement("a");
      link.href = dlUrl;
      if (new URL(dlUrl).origin !== location.origin) link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.download = paper.kind === "site" ? paper.fileName : fallbackName + ".pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast("Starting download…");
      return;
    }

    try {
      const record = await dbGet("files", id);
      if (!record || !record.blob) throw new Error("missing");
      const url = URL.createObjectURL(record.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        paper.fileName ||
        fallbackName + (paper.fileType === "application/pdf" ? ".pdf" : "");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      toast("Could not find the stored file for this paper.", { error: true });
    }
  }

  function openLinkPaper(id) {
    const paper = getPaper(id);
    if (!paper || !paper.url) {
      toast("This paper has no link attached.", { error: true });
      return;
    }
    const url = paper.kind === "site" ? siteUrl(paper) : paper.url;
    if (url) window.open(url, "_blank", "noopener");
  }

  /* ---------- Backup / restore ------------------------------------------ */
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma === -1 ? "" : result.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(base64, type) {
    const clean = base64.indexOf(",") === -1 ? base64 : base64.split(",").pop();
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: type || "application/octet-stream" });
  }

  async function exportLibrary() {
    if (!state.papers.length) {
      toast("Add a paper before exporting.");
      return;
    }
    toast("Preparing backup…", { timeout: 1800 });
    const payload = {
      app: "muhs-papers",
      version: 1,
      exportedAt: new Date().toISOString(),
      papers: [],
    };
    for (const paper of state.papers) {
      const copy = {};
      Object.keys(paper).forEach((key) => {
        if (key !== "blob") copy[key] = paper[key];
      });
      if (paper.kind === "file") {
        try {
          const record = await dbGet("files", paper.id);
          if (record && record.blob) {
            copy.fileData = await blobToBase64(record.blob);
          }
        } catch (err) {
          /* leave fileData out if the blob is gone */
        }
      }
      payload.papers.push(copy);
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "muhs-papers-backup-" + isoDay() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast("Backup downloaded");
  }

  async function importLibrary(file) {
    let payload;
    try {
      const text = await file.text();
      payload = JSON.parse(text);
    } catch (err) {
      toast("That file is not valid JSON.", { error: true });
      return;
    }
    const items = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.papers)
        ? payload.papers
        : null;
    if (!items) {
      toast("No papers found in that backup.", { error: true });
      return;
    }

    let added = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        if (!item || typeof item !== "object") {
          skipped += 1;
          continue;
        }
        const subject = SUBJECT_BY_ID.get(item.subjectId);
        const isModelOrComp = item.attemptType === "MODEL" || item.isCompilation || Boolean(catalogueGroup(item));
        const session = item.session;
        const year = isModelOrComp && item.year == null ? null : Math.trunc(Number(item.year));
        if (
          !subject ||
          (!isModelOrComp && ((session !== "Summer" && session !== "Winter") ||
          !Number.isFinite(year) ||
          year < 1990 ||
          year > CURRENT_YEAR + 1)) || (isModelOrComp && !siteUrl(item))
        ) {
          skipped += 1;
          continue;
        }
        const id =
          typeof item.id === "string" && item.id
            ? item.id.slice(0, 90)
            : makeId();
        if (getPaper(id)) {
          skipped += 1;
          continue;
        }
        const meta = normalizePaper({
          ...item,
          id: id,
          subjectId: subject.id,
          paperNumber: [1, 2].includes(Number(item.paperNumber)) ? Number(item.paperNumber) : null,
          session: session,
          year: year,
          title:
            typeof item.title === "string" ? item.title.trim().slice(0, 180) : "",
          addedAt:
            typeof item.addedAt === "string" && item.addedAt
              ? item.addedAt
              : new Date().toISOString(),
          demo: Boolean(item.demo),
        });
        if (state.papers.some((p) => T.isSamePaperRecord(p, meta) && (p.paperSection || "COMBINED") === (meta.paperSection || "COMBINED"))) {
          skipped += 1;
          continue;
        }

        let blob = null;
        if (typeof item.fileData === "string" && item.fileData) {
          const type =
            typeof item.fileType === "string" && item.fileType
              ? item.fileType
              : "application/pdf";
          if (!ACCEPTED_TYPES.includes(type) ||
              item.fileData.length > 4 * Math.ceil(MAX_FILE_BYTES / 3)) {
            skipped += 1;
            continue;
          }
          blob = base64ToBlob(item.fileData, type);
          if (!blob.size || blob.size > MAX_FILE_BYTES) {
            skipped += 1;
            continue;
          }
          meta.kind = "file";
          meta.fileType = type;
          meta.fileSize = blob.size;
          meta.fileName =
            typeof item.fileName === "string" && item.fileName
              ? item.fileName
              : "paper-" + year + ".pdf";
        } else if (item.kind === "site" && siteUrl(item)) {
          Object.assign(meta, {kind: "site", url: item.url, fileType: "application/pdf",
            fileName: item.url.split("/").pop(), fileSize: Number(item.fileSize) || 0});
          Object.assign(meta, normalizePaper(meta));
        } else if (typeof item.url === "string" && safeUrl(item.url)) {
          meta.kind = "link";
          meta.url = safeUrl(item.url);
        } else {
          skipped += 1;
          continue;
        }

        await dbPut("papers", meta);
        if (blob) {
          try {
            await dbPut("files", { id: id, blob: blob });
          } catch (fileError) {
            await dbDelete("papers", id);
            throw fileError;
          }
        }
        state.papers.push(meta);
        added += 1;
      } catch (err) {
        skipped += 1;
      }
    }

    pruneBookmarks();
    render();
    if (added) {
      toast(
        "Imported " +
          plural(added, "paper", "papers") +
          (skipped ? " · " + skipped + " skipped" : "")
      );
    } else {
      toast(
        skipped
          ? "No new papers were imported — they may already be here."
          : "Nothing to import in that backup.",
        { error: true }
      );
    }
  }

  async function resetLibrary() {
    if (!state.papers.length) return;
    const ok = window.confirm(
      "Remove all " +
        plural(state.papers.length, "paper", "papers") +
        " from this browser? This cannot be undone."
    );
    if (!ok) return;
    try {
      await dbClear("papers");
      await dbClear("files");
    } catch (err) {
      toast("Could not clear the library. Try again.", { error: true });
      return;
    }
    state.papers = [];
    state.bookmarks.clear();
    persistBookmarks();
    render();
    toast("Library cleared");
  }

  function clearFilters() {
    state.filters = { part: "all", session: "all", attempt: "all", scheme: "all", year: "all" };
    state.query = "";
    const input = document.getElementById("search-input");
    if (input) input.value = "";
    render();
  }

  function clearSearch() {
    state.query = "";
    const input = document.getElementById("search-input");
    if (input) input.value = "";
    render();
  }

  /* ---------- Bookmark hygiene ------------------------------------------ */
  function pruneBookmarks() {
    const ids = new Set(state.papers.map((p) => p.id));
    let changed = false;
    Array.from(state.bookmarks).forEach((id) => {
      if (!ids.has(id)) {
        state.bookmarks.delete(id);
        changed = true;
      }
    });
    if (changed) persistBookmarks();
  }

  /* ---------- Events ---------------------------------------------------- */
  function handleAction(element) {
    const action = element.dataset.action;
    const id = element.dataset.id || "";
    switch (action) {
      case "open-add":
        openAddModal(element.dataset.subject || null);
        break;
      case "prof-year":
        state.profYear = element.dataset.profYear || "all";
        render();
        break;
      case "bucket":
        state.curriculumBucket = element.dataset.bucket === "OLD" ? "OLD" : "CBME";
        state.filters.scheme = "all";
        state.filters.year = "all";
        render();
        break;
      case "bookmark":
        toggleBookmark(id, element);
        break;
      case "preview":
        openPreview(id);
        break;
      case "view-bhalani":
        openBhalaniPreview(element.dataset.profYear || "");
        break;
      case "download":
        downloadPaper(id);
        break;
      case "open-link":
        openLinkPaper(id);
        break;
      case "load-demo":
        loadDemo();
        break;
      case "export":
        exportLibrary();
        break;
      case "import": {
        const input = document.getElementById("import-file");
        if (input) input.click();
        break;
      }
      case "remove-demo":
        removeDemoPapers();
        break;
      case "reset":
        resetLibrary();
        break;
      case "clear-filters":
        clearFilters();
        break;
      case "clear-search":
        clearSearch();
        break;
      case "clear-file":
        clearAddFile();
        break;
      case "open-chai":
        openChaiModal();
        break;
      case "install-app":
        triggerInstallApp();
        break;
      case "chai-done":
        writeStorage(CHAI_DISMISS_KEY, "1");
        closeModal(true);
        toast("Thank you for supporting MUHS Papers!");
        break;
      case "copy-upi":
        if (CHAI_CONFIG.upiId && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(CHAI_CONFIG.upiId).then(() => toast("Copied UPI ID"));
        }
        break;
      default:
        break;
    }
  }

  function bindEvents() {
    const searchInput = document.getElementById("search-input");
    const themeToggle = document.getElementById("theme-toggle");

    document.addEventListener("click", (event) => {
      const target = event.target;

      if (target.classList && target.classList.contains("modal-backdrop")) {
        closeModal();
        return;
      }
      const closeButton = target.closest
        ? target.closest("button[data-close-modal]")
        : null;
      if (closeButton) {
        closeModal();
        return;
      }

      const actionElement = target.closest
        ? target.closest("[data-action]")
        : null;
      if (actionElement) handleAction(actionElement);
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.query = searchInput.value;
        render();
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          clearSearch();
          searchInput.focus();
        }
      });
    }

    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        persistTheme();
        applyTheme();
      });
    }

    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("[data-edit-part]")) {
        const paper = getPaper(target.dataset.editPart);
        const number = Number(target.value);
        if (!paper || ![1,2].includes(number)) return;
        target.disabled = true;
        dbPut("papers", { ...paper, paperNumber: number }).then(() => {
          paper.paperNumber = number;
          render();
          const metaEl = document.getElementById("preview-meta");
          if (metaEl) {
            const subject = SUBJECT_BY_ID.get(paper.subjectId);
            const phase = subject ? subjectPhase(subject) : null;
            metaEl.textContent = [
              phase ? phase.label : "",
              subject ? subject.name : "",
              partLabel(paper),
              examLabel(paper),
            ]
              .filter(Boolean)
              .join(" · ");
          }
          const emptyOpt = target.querySelector('option[value=""]');
          if (emptyOpt) emptyOpt.remove();
          target.disabled = false;
          toast("Saved as Paper " + number);
        }).catch(() => {
          target.disabled = false;
          target.value = String(paper.paperNumber || "");
          toast("Couldn't save the paper number.", {error: true});
        });
      } else if (target.id === "filter-part") {
        state.filters.part = target.value;
        render();
      } else if (target.id === "filter-session") {
        state.filters.session = target.value;
        render();
      } else if (target.id === "filter-attempt") {
        state.filters.attempt = target.value;
        render();
      } else if (target.id === "filter-scheme") {
        state.filters.scheme = target.value;
        render();
      } else if (target.id === "filter-year") {
        state.filters.year = target.value;
        render();
      } else if (target.id === "import-file") {
        const file = target.files && target.files[0];
        target.value = "";
        if (file) importLibrary(file);
      }
    });

    document.addEventListener("keydown", (event) => {
      const modalOpen = document.body.classList.contains("modal-open");
      if (modalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeModal();
        } else if (event.key === "Tab") {
          trapFocus(event);
        }
        return;
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const active = document.activeElement;
        const typing =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.tagName === "SELECT" ||
            active.isContentEditable);
        const searchWrap = searchInput ? searchInput.closest(".search") : null;
        if (!typing && searchInput && searchWrap && !searchWrap.hidden) {
          event.preventDefault();
          searchInput.focus();
        }
      }
    });

    window.addEventListener("hashchange", () => {
      const next = parseRoute();
      if (routeKey(next) === routeKey(state.route)) return;
      state.route = next;
      state.filters = { part: "all", session: "all", attempt: "all", scheme: "all", year: "all" };
      state.query = "";
      if (searchInput) searchInput.value = "";
      render({ animate: true });
      window.scrollTo(0, 0);
    });
  }

  /* ---------- Boot ------------------------------------------------------ */
  function validPaper(paper) {
    if (!paper || typeof paper !== "object" || typeof paper.id !== "string" || !SUBJECT_BY_ID.has(paper.subjectId)) {
      return false;
    }
    const isModelOrComp = paper.attemptType === "MODEL" || paper.isCompilation || Boolean(catalogueGroup(paper));
    if (isModelOrComp && siteUrl(paper)) return true;
    return (
      (paper.session === "Summer" || paper.session === "Winter") &&
      Number.isFinite(Number(paper.year))
    );
  }

  async function seedDefaultPapers(rawById) {
    await seedOriginalLibrary();
    const replaced = DATA.replacedPaperIds || {};
    let bookmarkMigrated = false;
    for (const [oldId, newId] of Object.entries(replaced)) {
      if (state.bookmarks.has(oldId)) {
        state.bookmarks.delete(oldId);
        state.bookmarks.add(newId);
        bookmarkMigrated = true;
      }
      const oldRec = getPaper(oldId) || (rawById && rawById.get(oldId));
      if (oldRec) {
        await dbDelete("papers", oldId);
        state.papers = state.papers.filter((p) => p.id !== oldId);
      }
    }
    if (bookmarkMigrated) persistBookmarks();

    const prevSeen = new Set([
      ...readArray("muhs.hosted.v1"),
      ...readArray("muhs.hosted.v2"),
      ...readArray("muhs.hosted.v3"),
    ]);
    const key = "muhs.hosted.v4";
    const seen = new Set(readArray(key));
    for (const item of DATA.hostedPapers || []) {
      if (seen.has(item.id) || !validPaper(item) || !siteUrl(item)) continue;
      const previous = getPaper(item.id) || (rawById && rawById.get(item.id));
      const original = DATA.defaultPapers.find((p) => p.id === item.id);
      const wasDeliberatelyDeleted = !previous && (prevSeen.has(item.id) || Boolean(original));
      const shouldUpgrade = Boolean(previous && (previous.kind === "site" || (previous.kind === "link" && original && previous.url === original.url)));
      if (shouldUpgrade || !wasDeliberatelyDeleted) {
        const copy = normalizePaper({ ...item });
        await dbPut("papers", copy);
        const existingInState = getPaper(item.id);
        if (existingInState) Object.assign(existingInState, copy);
        else state.papers.push(copy);
      }
      seen.add(item.id);
    }
    writeStorage(key, JSON.stringify([...seen]));
  }

  async function seedOriginalLibrary() {
    const defaults = Array.isArray(DATA.defaultPapers) ? DATA.defaultPapers : [];
    if (!defaults.length || readString(SEEDED_KEY) === "1") return;
    const replaced = DATA.replacedPaperIds || {};
    const existing = new Set(state.papers.map((p) => p.id));
    for (const item of defaults) {
      if (replaced[item.id] || !validPaper(item) || existing.has(item.id)) continue;
      const copy = normalizePaper({ ...item, year: Number(item.year) });
      await dbPut("papers", copy);
      state.papers.push(copy);
      existing.add(copy.id);
    }
    writeStorage(SEEDED_KEY, "1");
  }

  function openInstallModal() {
    const html =
      '<div class="modal-backdrop" data-close-modal><div class="modal" role="dialog" aria-modal="true" aria-labelledby="install-title">' +
      '<div class="modal-head"><div><h2 id="install-title">Install MUHS Papers</h2>' +
      '<p>Use MUHS Papers like a native app on Windows or Android.</p></div>' +
      '<button class="icon-btn modal-close" type="button" data-close-modal aria-label="Close">' +
      icon("close") +
      "</button></div>" +
      '<div class="modal-body">' +
      '<div class="install-grid">' +
      '<div class="install-card">' +
      "<h3>Windows (Chrome / Edge)</h3>" +
      "<p>Click the <strong>Install</strong> icon in the address bar (top right), or open browser menu <strong>⋮ / … → Apps → Install MUHS Papers</strong>.</p>" +
      "</div>" +
      '<div class="install-card">' +
      "<h3>Android (Web App or APK)</h3>" +
      "<p>In Chrome tap <strong>⋮ → Add to Home screen / Install app</strong>, or download the standalone Android APK below.</p>" +
      '<a class="btn btn-primary btn-sm" href="' +
      esc(APK_DOWNLOAD_URL) +
      '" target="_blank" rel="noopener noreferrer">' +
      icon("download") +
      "<span>Download Android APK</span></a>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="modal-foot"><a class="btn btn-ghost btn-sm" href="' +
      esc(APK_RELEASES_URL) +
      '" target="_blank" rel="noopener noreferrer">' +
      icon("external") +
      '<span>APK Releases</span></a><button class="btn btn-primary btn-sm" type="button" data-close-modal>Got it</button></div>' +
      "</div></div>";
    openModal(html);
  }

  async function triggerInstallApp() {
    if (state.installPrompt) {
      const promptEvent = state.installPrompt;
      state.installPrompt = null;
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === "accepted") {
          toast("Installing MUHS Papers…");
        }
      } catch (err) {
        openInstallModal();
      }
      return;
    }
    openInstallModal();
  }

  async function boot() {
    initTheme();
    state.route = parseRoute();
    bindEvents();
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installPrompt = event;
    });
    window.addEventListener("appinstalled", () => {
      state.installPrompt = null;
      toast("MUHS Papers installed!");
      render();
    });
    if (window.MUHS_SUBJECT_CODES && window.MUHS_SUBJECT_CODES.load) {
      await window.MUHS_SUBJECT_CODES.load("./muhs-subject-codes.json");
    }
    try {
      const papers = await dbGetAll("papers");
      const rawById = new Map(papers.map((p) => [p.id, p]));
      state.papers = papers.filter(validPaper).map(normalizePaper);
      await seedDefaultPapers(rawById);
    } catch (err) {
      state.storageOk = false;
      console.warn("MUHS Papers: browser storage unavailable", err);
      if (Array.isArray(DATA.defaultPapers)) {
        const replaced = DATA.replacedPaperIds || {};
        const catalogue = new Map();
        for (const p of [...DATA.defaultPapers, ...(DATA.hostedPapers || [])]) {
          if (!replaced[p.id]) catalogue.set(p.id, p);
        }
        state.papers = [...catalogue.values()].filter(validPaper).map(normalizePaper);
      }
    }
    state.loading = false;
    pruneBookmarks();
    render();
    scheduleChaiPopup();
    if (
      "serviceWorker" in navigator &&
      (location.protocol === "https:" ||
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1")
    ) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    if (!state.storageOk) {
      toast(
        "Browser storage is unavailable — papers you add won't persist. Run the app through npm start or a hosted URL.",
        { error: true, timeout: 8000 }
      );
    }
  }

  boot();
})();
