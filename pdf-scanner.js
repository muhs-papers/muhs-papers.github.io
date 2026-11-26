(function (root, factory) {
  const api = factory(
    typeof window !== "undefined" ? window.MUHS_TAXONOMY : require("./taxonomy.js"),
    typeof window !== "undefined" ? window.MUHS_SUBJECT_CODES : require("./subject-codes.js")
  );
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MUHS_PDF_SCANNER = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (T, SC) {
  "use strict";

  const PDFJS_PATH = "./vendor/pdfjs/pdf.min.mjs";
  const PDFJS_WORKER_PATH = "./vendor/pdfjs/pdf.worker.min.mjs";
  const TESSERACT_SCRIPT_PATH = "./vendor/tesseract/tesseract.min.js";
  const TESSERACT_WORKER_PATH = "./vendor/tesseract/worker.min.js";
  const TESSERACT_CORE_PATH = "./vendor/tesseract/tesseract-core-lstm.wasm.js";
  const TESSERACT_LANG_PATH = "./vendor/tesseract/lang-data";

  let pdfjsPromise = null;
  let tesseractScriptPromise = null;
  let tesseractWorkerPromise = null;
  let ocrQueue = Promise.resolve();

  function toAbsUrl(relPath) {
    if (typeof window !== "undefined" && window.location && window.location.href) {
      return new URL(relPath, window.location.href).href;
    }
    return relPath;
  }

  async function loadPdfJs() {
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = import(toAbsUrl(PDFJS_PATH)).then((mod) => {
      if (mod && mod.GlobalWorkerOptions) {
        mod.GlobalWorkerOptions.workerSrc = toAbsUrl(PDFJS_WORKER_PATH);
      }
      return mod;
    });
    return pdfjsPromise;
  }

  function loadScriptOnce(src) {
    if (typeof document === "undefined") {
      return Promise.reject(new Error("Document is not available"));
    }
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-dynamic-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === "1") resolve();
        else existing.addEventListener("load", () => resolve(), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.dynamicSrc = src;
      script.onload = () => {
        script.dataset.loaded = "1";
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load script: " + src));
      document.head.appendChild(script);
    });
  }

  async function getOcrWorker() {
    if (tesseractWorkerPromise) return tesseractWorkerPromise;
    tesseractWorkerPromise = (async () => {
      if (!window.Tesseract) {
        if (!tesseractScriptPromise) {
          tesseractScriptPromise = loadScriptOnce(TESSERACT_SCRIPT_PATH);
        }
        await tesseractScriptPromise;
      }
      if (!window.Tesseract || typeof window.Tesseract.createWorker !== "function") {
        throw new Error("OCR engine could not be initialized.");
      }
      // Single LSTM worker backed by vendored local WASM + gzipped English traineddata.
      return window.Tesseract.createWorker("eng", 1, {
        workerPath: toAbsUrl(TESSERACT_WORKER_PATH),
        workerBlobURL: false,
        corePath: toAbsUrl(TESSERACT_CORE_PATH),
        langPath: toAbsUrl(TESSERACT_LANG_PATH),
      });
    })().catch((err) => {
      tesseractWorkerPromise = null;
      throw err;
    });
    return tesseractWorkerPromise;
  }

  function runOcrOnCanvas(canvas) {
    const task = ocrQueue.then(async () => {
      const worker = await getOcrWorker();
      const result = await worker.recognize(canvas);
      return result && result.data && result.data.text ? result.data.text : "";
    });
    ocrQueue = task.catch(() => {});
    return task;
  }

  async function computeSha256Hex(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    const nodeCrypto = require("crypto");
    return nodeCrypto.createHash("sha256").update(bytes).digest("hex");
  }

  /**
   * Infer whether text represents an MCQ-only or Theory-only split upload vs full COMBINED paper.
   * Strips MUHS "Total Duration : Section A + B" headers before matching section markers.
   */
  function detectPaperSection(rawText) {
    const cleaned = T && typeof T.stripFooterBoilerplate === "function"
      ? T.stripFooterBoilerplate(rawText)
      : String(rawText || "");
    const withoutDuration = cleaned.replace(/Total\s+Duration\s*:[^\n]*/gi, " ");
    const hasMcq =
      /\bSECTION\s*["'""-]?\s*A\b(?:\s*\(?M\.?C\.?Q\.?\)?)?|\bSECTION\s*A\s+Marks\b|\bMultiple\s+Choice\s+Questions?\b/i.test(
        withoutDuration
      );
    const hasTheory =
      /\bSECTION\s*["'""-]?\s*B\b|\bSECTION\s*B\s+Marks\b|\bLONG\s+ANSWER\s+QUESTIONS?\b|\bSHORT\s+ANSWER\s+QUESTIONS?\b|\bLAQ\b|\bSAQ\b|\bBAQ\b/i.test(
        withoutDuration
      );
    if (hasMcq && !hasTheory) return "MCQ";
    if (hasTheory && !hasMcq) return "THEORY";
    return "COMBINED";
  }

  function isHeaderExtractionSufficient(parsed) {
    if (!parsed) return false;
    const hasSubject = Boolean(parsed.subjectId);
    const hasExam = Boolean(parsed.examSession && parsed.examYear);
    const hasAnchor = Boolean(parsed.qpCode || parsed.curriculumScheme);
    return hasSubject && hasExam && hasAnchor;
  }

  function inferPaperSectionFromRecord(record) {
    if (!record) return "COMBINED";
    if (record.paperSection === "MCQ" || record.paperSection === "THEORY" || record.paperSection === "COMBINED") {
      return record.paperSection;
    }
    const hint = [record.notes, record.title, record.fileName].filter(Boolean).join(" ");
    if (/\bMCQ\s+only\b/i.test(hint)) return "MCQ";
    if (/\bTheory\s+only\b/i.test(hint)) return "THEORY";
    return "COMBINED";
  }

  /**
   * Check whether a candidate paper already exists in existingPapers.
   * Rejects identical files (SHA-256) and matching MUHS taxonomy records unless complementary split halves (MCQ vs THEORY).
   */
  function findDuplicatePaper(candidate, existingPapers) {
    if (!candidate || !Array.isArray(existingPapers)) return null;
    const candSha = candidate.fileSha256 ? String(candidate.fileSha256).toLowerCase() : "";
    const candSec = inferPaperSectionFromRecord(candidate);

    for (const existing of existingPapers) {
      if (!existing) continue;
      if (candSha && existing.fileSha256 && String(existing.fileSha256).toLowerCase() === candSha) {
        return { existing, reason: "exact-file" };
      }
      if (T && typeof T.isSamePaperRecord === "function" && T.isSamePaperRecord(existing, candidate)) {
        const exSec = inferPaperSectionFromRecord(existing);
        const complementarySplit =
          (exSec === "MCQ" && candSec === "THEORY") ||
          (exSec === "THEORY" && candSec === "MCQ");
        if (!complementarySplit) {
          return { existing, reason: "taxonomy" };
        }
      }
    }
    return null;
  }

  function joinPdfTextItems(items) {
    const lines = [];
    let currentLine = [];
    let prevY = null;
    for (const item of items || []) {
      const str = String(item && item.str ? item.str : "");
      if (!str && !(item && item.hasEOL)) continue;
      const y = item && Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
      if (prevY !== null && y !== null && Math.abs(y - prevY) > 4 && currentLine.length) {
        lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
        currentLine = [];
      }
      if (str.trim()) currentLine.push(str.trim());
      if (item && item.hasEOL && currentLine.length) {
        lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
        currentLine = [];
      }
      if (y !== null) prevY = y;
    }
    if (currentLine.length) {
      lines.push(currentLine.join(" ").replace(/\s+/g, " ").trim());
    }
    return lines.filter(Boolean).join("\n");
  }

  function enhanceContrastForOcr(canvas) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return canvas;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Luminance with gentle contrast stretch keeps faint stamps/QP codes crisp.
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const stretched = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 132));
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  async function renderPdfPageRegionToCanvas(page, scale, topRatio) {
    const viewport = page.getViewport({ scale });
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = Math.max(1, Math.floor(viewport.width));
    fullCanvas.height = Math.max(1, Math.floor(viewport.height));
    const fullCtx = fullCanvas.getContext("2d", { alpha: false });
    fullCtx.fillStyle = "#ffffff";
    fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    await page.render({ canvasContext: fullCtx, viewport }).promise;

    if (!topRatio || topRatio >= 1) {
      return enhanceContrastForOcr(fullCanvas);
    }
    const cropHeight = Math.max(1, Math.floor(fullCanvas.height * topRatio));
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = fullCanvas.width;
    cropCanvas.height = cropHeight;
    const cropCtx = cropCanvas.getContext("2d", { alpha: false });
    cropCtx.drawImage(fullCanvas, 0, 0, fullCanvas.width, cropHeight, 0, 0, fullCanvas.width, cropHeight);
    return enhanceContrastForOcr(cropCanvas);
  }

  async function imageFileToCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode image"));
        el.src = url;
      });
      const minWidth = 1400;
      const scale = img.naturalWidth > 0 && img.naturalWidth < minWidth ? minWidth / img.naturalWidth : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return enhanceContrastForOcr(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function compactHeaderSummary(text) {
    const cleaned = T && typeof T.stripFooterBoilerplate === "function"
      ? T.stripFooterBoilerplate(text)
      : String(text || "");
    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.slice(0, 10).join(" | ").slice(0, 480);
  }

  function buildSuggestedTitle(parsed, file) {
    if (!T || !parsed) return "";
    if (parsed.subject && (parsed.examYear || parsed.examSession || parsed.curriculumScheme)) {
      return T.formatPaperTitle({
        subject: parsed.subject,
        subjectId: parsed.subjectId,
        paperNumber: parsed.paperNumber,
        curriculumScheme: parsed.curriculumScheme,
        examSession: parsed.examSession,
        examYear: parsed.examYear,
        attemptType: parsed.attemptType,
        session: parsed.examSession ? T.formatSessionLabel(parsed.examSession) : null,
        year: parsed.examYear,
      });
    }
    return file ? "" : "";
  }

  /**
   * Scan an uploaded PDF or image file strictly from its document contents (never filenames).
   */
  async function scanPaperFile(file, options) {
    const opts = options || {};
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : () => {};
    const checkCancelled = () => Boolean(opts.signal && opts.signal.aborted);

    onProgress({ stage: "hash", message: "Checking file signature…" });
    const buffer = await file.arrayBuffer();
    if (checkCancelled()) return null;

    const fileSha256 = await computeSha256Hex(buffer);
    if (checkCancelled()) return null;

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    let embeddedText = "";
    let ocrText = "";
    let ocrUsed = false;
    let parsed = T.parseHeader("", { inferredCohortHint: file.name || null });

    if (isPdf) {
      onProgress({ stage: "pdf", message: "Reading embedded PDF text…" });
      const pdfjsLib = await loadPdfJs();
      if (checkCancelled()) return null;

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
      });
      const pdf = await loadingTask.promise;
      try {
        const textPages = Math.min(4, pdf.numPages);
        const embeddedParts = [];
        for (let p = 1; p <= textPages; p += 1) {
          if (checkCancelled()) return null;
          const page = await pdf.getPage(p);
          const tc = await page.getTextContent();
          const pageStr = joinPdfTextItems(tc.items);
          if (pageStr) embeddedParts.push(pageStr);
        }
        embeddedText = embeddedParts.join("\n");
        parsed = T.parseHeader(embeddedText, { inferredCohortHint: file.name || null });

        // Scanned PDFs have empty/noisy embedded text layers — fall back to header OCR.
        const maxOcrPages = Math.min(3, pdf.numPages);
        for (let p = 1; p <= maxOcrPages && !isHeaderExtractionSufficient(parsed); p += 1) {
          if (checkCancelled()) return null;
          ocrUsed = true;
          onProgress({
            stage: "ocr",
            message: "Scanning page " + p + " of " + maxOcrPages + " header via OCR…",
          });
          const page = await pdf.getPage(p);
          const cropCanvas = await renderPdfPageRegionToCanvas(page, 2.0, p === 1 ? 0.56 : 1);
          if (checkCancelled()) return null;
          const topOcr = await runOcrOnCanvas(cropCanvas);
          if (topOcr && topOcr.trim()) {
            ocrText = [ocrText, topOcr.trim()].filter(Boolean).join("\n");
            const combined = [embeddedText, ocrText].filter(Boolean).join("\n");
            parsed = T.parseHeader(combined, { inferredCohortHint: file.name || null });
          }

          if (p === 1 && !isHeaderExtractionSufficient(parsed)) {
            if (checkCancelled()) return null;
            onProgress({
              stage: "ocr",
              message: "Scanning full page 1 via OCR…",
            });
            const fullCanvas = await renderPdfPageRegionToCanvas(page, 1.85, 1);
            if (checkCancelled()) return null;
            const fullOcr = await runOcrOnCanvas(fullCanvas);
            if (fullOcr && fullOcr.trim()) {
              ocrText = [ocrText, fullOcr.trim()].filter(Boolean).join("\n");
              const combined = [embeddedText, ocrText].filter(Boolean).join("\n");
              parsed = T.parseHeader(combined, { inferredCohortHint: file.name || null });
            }
          }
        }
      } finally {
        if (typeof pdf.destroy === "function") {
          await pdf.destroy().catch(() => {});
        }
      }
    } else {
      ocrUsed = true;
      onProgress({ stage: "ocr", message: "Running OCR on uploaded image…" });
      const imgCanvas = await imageFileToCanvas(file);
      if (checkCancelled()) return null;
      ocrText = await runOcrOnCanvas(imgCanvas);
      parsed = T.parseHeader(ocrText, { inferredCohortHint: file.name || null });
    }

    if (checkCancelled()) return null;
    const extractedText = [embeddedText, ocrText].filter(Boolean).join("\n").trim();
    const cleanedText = T.stripFooterBoilerplate(extractedText);
    const paperSection = detectPaperSection(cleanedText);
    const rawHeaderText = compactHeaderSummary(cleanedText);
    const suggestedTitle = buildSuggestedTitle(parsed, file);

    return {
      fileSha256,
      extractedText,
      cleanedText,
      rawHeaderText,
      parsed,
      paperSection,
      suggestedTitle,
      ocrUsed,
    };
  }

  return {
    computeSha256Hex,
    detectPaperSection,
    isHeaderExtractionSufficient,
    inferPaperSectionFromRecord,
    findDuplicatePaper,
    scanPaperFile,
  };
});
