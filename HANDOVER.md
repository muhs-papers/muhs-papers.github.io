# MUHS Papers — Project Handover (`HANDOVER.md`)

## Current checkpoint — hosted PDF migration

The original handover below is historical. Local changes were saved as commit
`8df831d` on `checkpoint/pre-pdf-migration`. Work now continues on
`migration/site-pdfs`, based on verified remote `main` (`5cfe11a`). The web
source matched the remote; local ignore rules, lockfile and this handover were
carried forward. The obsolete local-only Pages workflow was not reinstated.
Section 13 contains 170 unique IDs (~607 MB by listed sizes, not 450–550 MB).
The older scratch cache contains 45 PDFs. No AGENTS.md was present at review.

**Staging completed:** `scripts/stage-papers.js` downloaded all 170 source IDs
to `%TEMP%\opencode\muhs-stage` (635,987,286 bytes; 170 distinct SHA-256
hashes; checked PDF signature and EOF). `inventory.json` there maps source ID,
folder, filename, byte size and SHA-256. None is byte-identical to the 45
older cached PDFs. This does not rule out different scans of the same exam.
`scripts/read-pdf-header.ps1` renders and OCRs a chosen page on Windows.
`scripts/extract-review.ps1` saves resumable header evidence.

**Pilot verified locally:** `papers/anatomy/summer-2025-paper-1-cbme.pdf`
is a five-page scan from the new folder. Its printed header says Summer 2025,
Anatomy I (CBME); sections A and B were checked. Both original Pathology
Winter 2023 papers were matched to the earlier scratch downloads by ID and
their printed exam headers. These three files exercise new records and upgrades.
Hosted metadata is in `DATA.hostedPapers`; legacy records keep their IDs.
The `muhs.hosted.v1` localStorage ledger tracks individual additions. An Edge
test on a `/muhs-papers/` test origin passed inline preview, actual PDF
download, backup/restore, preservation of a personal link, bookmark, edited
paper number, and intentionally deleted seed. Local Node serves `application/pdf`;
the Android wrapper resolves hosted paths against Pages without bundling PDFs.
This is not yet deployed. First-page OCR exists for all 170 files (1,728 pages
total); review all paper boundaries before promoting multi-paper scans.

**Handover Date:** 2026-11-25  
**Workspace Root:** `C:\MUHS APP`  
**Live GitHub Pages URL:** <https://kodestien234.github.io/muhs-papers/>  
**GitHub Repository:** <https://github.com/Kodestien234/muhs-papers> (`main` branch)  
**Latest APK Release:** <https://github.com/Kodestien234/muhs-papers/releases/tag/apk-latest>

---

## 1. Project Overview & Objectives

**MUHS Papers** is a local-first, zero-dependency static web application and installable Android PWA / Capacitor Android app for **Maharashtra University of Health Sciences (MUHS) MBBS** previous year question papers.

### Core Objectives
- Organize question papers by the MUHS MBBS (CBME) academic hierarchy: **Phase → Subject → Exam Year → Exam Session (Summer / Winter) → Paper Number (Paper 1 / Paper 2)**.
- Provide fast, offline-friendly browsing, full-text client-side search (`/` shortcut), filtering by Paper 1/2, Summer/Winter, and Year, in-app PDF/image preview, per-paper PDF download, bookmarking, and JSON backup/restore.
- Host the site publicly on **GitHub Pages** (`https://kodestien234.github.io/muhs-papers/`) and distribute an Android **APK** (`MUHS-Papers.apk`) built via Capacitor + GitHub Actions.
- Transition from external Google Drive `/preview` links to **hosting the actual PDF files directly inside the site's static data** so papers preview and download natively from the site without relying on Google Drive embeds.

---

## 2. User Requirements & Preferences Discussed

1. **Paper 1 & Paper 2 support on every subject**:
   - Every subject page must provide filtering (`Both papers`, `Paper 1`, `Paper 2`, plus `Number not set` if any exist), radio selection (`Paper 1` / `Paper 2`) when adding papers, and inline editing inside the preview modal.
2. **Accurate Summer vs. Winter segregation**:
   - Do **not** guess exam sessions from filenames alone. Actual PDF headers/pages must be inspected to verify whether a paper is **Summer** or **Winter** (earlier, 38 single-year Phase II PDFs without `Summer`/`Winter` in their Drive filenames turned out to be **Winter** exams upon reading the scanned PDF headers).
3. **Download option for every PDF**:
   - Every paper row and preview modal must expose a **Download** action (not just external "Open link").
4. **Mobile UI optimization & alignment**:
   - Clean, overflow-free mobile layout (`390×844` / `<= 680px`): aligned header buttons, balanced nav padding, side-by-side subject monogram + title, aligned 2-column filter grid, 2-row paper cards showing the `SUMMER`/`WINTER` badge alongside all 4 action icons, scrollable modal forms with pinned footers, and side-by-side footer buttons in the preview modal.
5. **Default theme must be Light**:
   - Fresh sessions must always open in **light mode** (`data-theme="light"`), ignoring OS `prefers-color-scheme: dark`, while preserving manual dark/light toggling via `localStorage`.
6. **GitHub Pages + Android APK**:
   - Site must stay live on GitHub Pages (`https://kodestien234.github.io/muhs-papers/`), with an installable Android APK (`MUHS-Papers.apk`) via GitHub Actions. (User noted APK can be rebuilt after site changes stabilize.)
7. **Latest Request (In Progress at Handover) — Direct Site-Hosted PDFs**:
   - Source folder: `https://drive.google.com/drive/folders/11wVsDhJ-vFwgIEJ_PYQYjV63LWYq6Zhy` (user shared `/u/1/` URL; public folder loads without sign-in).
   - **Instruction:** Sort all papers by **year, subject, and paper (Paper 1 / Paper 2, Summer / Winter)** and **upload the PDFs directly into the site data rather than embedding Google Drive links**.

---

## 3. Current Technology Stack & Project Architecture

- **Frontend:** Vanilla HTML5, CSS3, ES6+ JavaScript (no framework, no bundler, no runtime npm dependencies).
- **Fonts & Icons:** Self-hosted `Open Sans` (`fonts/open-sans.woff2`), inline UI sprite (`index.html`), custom subject SVG sprite (`subject-icons.svg`), SVG + PNG app icons (`icon.svg`, `icon-192.png`, `icon-512.png`).
- **Client Storage:**
  - `IndexedDB` (`muhs-papers`, v1): object stores `papers` (metadata keyed by `id`) and `files` (`{ id, blob }` for user-uploaded PDFs/images).
  - `localStorage`: `muhs.bookmarks.v1`, `muhs.theme`, `muhs.lastSubject`, `muhs.seeded.v1`.
- **PWA / Offline:** `manifest.json` + `sw.js` (`CACHE_NAME = "muhs-papers-v3"`, network-first with cache fallback for same-origin GET requests).
- **Local Dev Server:** `server.js` (zero-dependency Node HTTP static server on port `4173`).
- **Android Wrapper & CI/CD:**
  - Capacitor `^8.6.2` (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`) with `scripts/prepare-www.js` staging web assets into `www/` (`capacitor.config.json`: `appId: "in.muhspapers.app"`, `appName: "MUHS Papers"`, `webDir: "www"`).
  - `.github/workflows/android-apk.yml`: builds debug APK (`MUHS-Papers.apk`) using Node 22, Java 21, preinstalled Android SDK `sdkmanager` (`platforms;android-36`, `build-tools;36.0.0`), Gradle `8.14.3`, and publishes to GitHub Release `apk-latest`.
  - GitHub Pages deploys directly from `main` branch (`/ (root)`) with `.nojekyll`.

### Subject Catalogue (`data.js` — 4 Phases, 19 Subjects)
- **Phase I (`phase1`):** `anatomy`, `physiology`, `biochemistry`
- **Phase II (`phase2`):** `pathology`, `pharmacology`, `microbiology`, `forensic`
- **Phase III · Part I (`phase3a`):** `ent`, `ophthalmology`, `community`
- **Phase III · Part II (`phase3b`):** `medicine`, `surgery`, `pediatrics`, `obgyn`, `orthopedics`, `psychiatry`, `dermatology`, `anesthesiology`, `radiology`

---

## 4. Features Already Implemented

1. **Full Catalogue Browse, Hash Routing & Search (`app.js`):**
   - Views: Browse (`#/`), Subject (`#/subject/<id>`), Bookmarks (`#/bookmarks`), About (`#/about`).
   - Phase filter tabs (`All phases`, `Phase I`, `Phase II`, `Phase III · Part I`, `Phase III · Part II`).
   - Global `/` search across subject names/codes/blurbs, paper titles, Paper 1/2 labels, session, year, and filename.
2. **Paper 1 / Paper 2 & Session Filtering:**
   - Filters on subject pages (`#filter-part`, `#filter-session`, `#filter-year`), Paper 1 sorted before Paper 2 within each year/session (`byRecency`), and stale filter auto-reset when `"0"` (`Number not set`) or year disappears.
3. **Add Paper, In-App Preview, Edit Paper Number, Bookmark & Undoable Delete:**
   - Upload local PDF/JPG/PNG/WEBP (up to 20 MB into IndexedDB) or attach an HTTP(S) link.
   - Modal preview with in-place `[data-edit-part]` Paper 1/2 updates and preserved `state.lastFocus` on close.
   - `downloadPaper()` supports both IndexedDB blobs and external/Google Drive links (`drive.google.com/uc?export=download&id=<id>`).
   - JSON export/import backup (`About`), demo sample PDF generator (`DEMO_VERSION = 2`), and library clear.
4. **54 Preloaded Phase II Papers (Currently Drive Links):**
   - `data.js` (`defaultPapers`) currently seeds 54 Phase II Google Drive `/preview` links (`pathology`: 20, `pharmacology`: 18, `microbiology`: 16) once on first boot (`muhs.seeded.v1`).
5. **Light-by-Default Theme & Mobile Responsive UI:**
   - `index.html` and `app.js` default to `"light"` (`data-theme="light"`), with manual dark toggle.
   - Mobile CSS (`<= 900px`, `<= 680px`, `<= 460px`) with 2-column filter grid, 2-row paper cards, and flex-scrolling `#add-form`.
6. **PWA & Android APK Pipeline:**
   - `manifest.json`, `icon-192.png`, `icon-512.png`, `sw.js`, `capacitor.config.json`, `scripts/prepare-www.js`, `.github/workflows/android-apk.yml`.

---

## 5. Features Partially Implemented

1. **Direct Site-Hosted PDFs (Replacing Google Drive Links):**
   - **Done:** Full recursive crawl of the new Google Drive root folder (`11wVsDhJ-vFwgIEJ_PYQYjV63LWYq6Zhy`) completed — all **14 subject folders**, **105 subfolders**, and **170 PDF files** are inventoried in Section 13 below.
   - **Not Yet Done:** Downloading the 170 PDFs, inspecting PDF headers/contents to classify exact Paper 1/2, Summer/Winter, and year (especially generic files like `Old Question Paper.pdf`, `Winter 2020.pdf`, `Anatomy.pdf`, `MCQ 2019.pdf`, etc.), storing the PDFs as static site files (e.g., `papers/<subjectId>/...`), updating `app.js` so relative same-origin PDF paths render with a `PDF` badge (not `LINK` / `"External link"` / `"Some sites block embedding"`), updating `data.js` (`defaultPapers`), and deploying to GitHub Pages.
2. **APK Rebuild & Capacitor Web Asset Handling:**
   - An APK was built and released at commit `1970543`, and CI also built `#4` at `5cfe11a`, **but** once PDFs are committed directly to the repo (`~450–550 MB` total across the 170 PDFs), `scripts/prepare-www.js` and `capacitor.config.json` must decide whether to bundle PDFs into the APK or fetch them from `https://kodestien234.github.io/muhs-papers/papers/...` so the APK doesn't balloon to ~500 MB.
3. **Local Git Sync with `origin/main`:**
   - Local `C:\MUHS APP` has commit `cb4b59f` plus uncommitted changes, whereas `origin/main` was updated via GitHub web uploads (`a0b774a` .. `5cfe11a`). Histories are currently diverged (see Section 8).

---

## 6. Pending Tasks (Priority Order)

1. **Download & inspect the 170 PDFs from `11wVsDhJ-vFwgIEJ_PYQYjV63LWYq6Zhy`**:
   - Download into a temporary/staging directory (e.g., outside git or directly into sorted `papers/<subjectId>/` folders) using `https://drive.google.com/uc?export=download&id=<FILE_ID>`.
   - Inspect each PDF's printed headers/pages (especially ambiguous names like `Old Question Paper.pdf`, `Anatomy.pdf`, `Winter 2020.pdf`, `Microbiology Second MBBS Paper I.pdf`, `Obstetrics & Gynecology Old -Winter 2023...`, `2025` Jan/Feb papers, and `CBME` vs `Old` papers) to determine exact:
     - `subjectId` (note: check whether `Old Question Paper.pdf` in each folder is a multi-year compilation or single exam, and check whether the 54 Phase II papers from the previous Drive link `1LWxBmHtJ-DJB_G1x04q7tb3aU9RoWVcm` should be merged/kept or replaced).
     - `paperNumber` (`1`, `2`, or `null` if a file combines Paper 1 & 2, or split PDFs if needed/desired).
     - `session` (`Summer` or `Winter` — note Jan/Feb papers in MUHS are typically Winter session exams; verify from the printed header!).
     - `year` (`2020`–`2025`, or compilation end year).
2. **Support Same-Origin Site PDFs Cleanly in `app.js` (and `data.js`)**:
   - Currently `safeUrl()` (`app.js` line 1419) uses `new URL(value)` with **only `http:` / `https:`**, which rejects relative paths like `"papers/anatomy/..."`, AND `paperRow()` / `paperMeta()` / `openPreview()` treat `kind: "link"` as `"LINK"` / `"External link"` with the `"Some sites block embedding."` warning!
   - Add support for a same-origin hosted PDF type (e.g. `kind: "site"` or relative-path `kind: "link"` with `fileType: "application/pdf"` and `fileSize`):
     - `safeUrl()` / `resolvePaperUrl()` must allow safe relative `papers/...` paths (no `..` traversal) or resolve relative to `location.href`.
     - `fileExt()` → `"PDF"`, `badgeClass()` → `"pdf"`, `paperMeta()` → `"PDF · <size>"`, `openPreview()` → no `"Some sites block embedding"` banner, `downloadPaper()` → direct `<a href="..." download="...">` same-origin download.
   - Update `SEEDED_KEY` (e.g., bump from `"muhs.seeded.v1"` to `"muhs.seeded.v2"` and merge/replace old `gdrive_*` entries cleanly for returning visitors without wiping user-added papers/bookmarks!).
3. **Sync Local Git & Push All PDFs + Updated Code to `origin/main`**:
   - Reconcile local `.git` with `origin/main` (since pushing ~170 PDFs via GitHub web upload is impractical, use interactive `git` auth or GitHub PAT / `gh` CLI to `git push` cleanly).
   - Verify `.github/workflows/pages.yml` / GitHub Pages branch deploy succeeds and stays well within GitHub Pages' 1 GB site limit.
4. **Update `scripts/prepare-www.js` / `android-apk.yml` & Rebuild APK (after Pages is verified)**:
   - Decide whether APK fetches `papers/...` from `https://kodestien234.github.io/muhs-papers/` or bundles a subset, because embedding ~500 MB of PDFs directly into `www/` makes `MUHS-Papers.apk` ~500 MB (and GitHub Releases has a 2 GB asset limit, though mobile users prefer < 20–50 MB APKs).
5. **Minor Pre-existing Polish (Low Priority)**:
   - Native `<select>` arrow (`▼`) still appeared alongside the custom SVG chevron in headless Chromium screenshots (`final_step_87.png` / `final_step_20.png`) despite `appearance: none; -webkit-appearance: none; -moz-appearance: none;`. Verify in desktop/mobile Chrome and check `line-height` alignment.
   - Clean up unused legacy `.hero` / `.hero-card` / `.hero-stats` / `.stat` / `.hc-*` CSS rules in `styles.css` (lines ~541–726) if desired.

---

## 7. Important Files & Purposes

| File / Path | Purpose |
| --- | --- |
| `C:\MUHS APP\index.html` | App shell, inline theme bootstrap (defaults to `"light"`), inline SVG UI sprite (`#i-*`), topbar, footer, modal/toast roots. |
| `C:\MUHS APP\styles.css` | Design system, light/dark CSS tokens, library identity override block (lines 2655+), mobile responsive rules (`<= 900px`, `<= 680px`, `<= 460px`). |
| `C:\MUHS APP\data.js` | `window.MUHS_DATA`: 4 phases, 19 subjects, `Summer`/`Winter` sessions, `firstYear: 2012`, and `defaultPapers` (currently 54 Phase II Drive links). |
| `C:\MUHS APP\app.js` | All client logic: IndexedDB (`muhs-papers`), `localStorage`, hash router, search, filters, Add/Preview/Download/Delete/Bookmark, JSON export/import, `seedDefaultPapers()`, SW registration. |
| `C:\MUHS APP\sw.js` | Service worker (`muhs-papers-v3`), network-first with offline cache fallback for local shell assets. |
| `C:\MUHS APP\manifest.json` | PWA metadata referencing `icon-192.png`, `icon-512.png`, and `icon.svg`. |
| `C:\MUHS APP\icon.svg`, `icon-192.png`, `icon-512.png` | Orbit-and-pages emblem SVG + raster PNG icons. |
| `C:\MUHS APP\subject-icons.svg` | 19 `<symbol>` definitions matching all 19 `subject.id` values in `data.js`. |
| `C:\MUHS APP\fonts\open-sans.woff2`, `OFL.txt` | Local Open Sans variable webfont and license. |
| `C:\MUHS APP\server.js` | Zero-dependency Node static server on port `4173` (`npm start`). |
| `C:\MUHS APP\package.json` | `start`, `build:web`, `cap:sync` scripts + Capacitor `^8.6.2` dependencies. |
| `C:\MUHS APP\capacitor.config.json` | Capacitor config (`appId: "in.muhspapers.app"`, `appName: "MUHS Papers"`, `webDir: "www"`). |
| `C:\MUHS APP\scripts\prepare-www.js` | Copies static web files + `fonts/` into `www/` for Capacitor. |
| `C:\MUHS APP\.github\workflows\android-apk.yml` | Builds `MUHS-Papers.apk` in CI (Java 21, `sdkmanager`, Gradle) and publishes to `apk-latest` release. |
| `C:\MUHS APP\.github\workflows\pages.yml` | GitHub Actions Pages workflow (currently repo deploys via branch `main` `/ (root)` with `.nojekyll`). |
| `C:\MUHS APP\.gitignore` | Ignores `node_modules/`, `www/`, `.DS_Store`, `Thumbs.db`, `android/`, `*.apk`. |
| `C:\MUHS APP\MUHS-Papers.apk` | Locally downloaded APK from build `#2` (`1970543`, 4,455,570 bytes — older than `5cfe11a`). |

*(Note: Previous Antigravity conversation artifacts/scratch files are in `C:\Users\kdkad\.gemini\antigravity\brain\021d81b1-374c-4081-9b8c-b641d088d121\scratch\` — including `muhs-2nd-yr-papers.json` and 44 downloaded Phase II PDFs in `scratch\pdfs\`.)*

---

## 8. Known Bugs & Unresolved Issues

1. **Local Git vs. Remote `origin/main` Divergence:**
   - Local `.git` has root commit `cb4b59f` + uncommitted edits, while `origin/main` has commits `a0b774a` through `5cfe11a` uploaded via GitHub web UI. Before pushing via CLI, fetch `origin` and reconcile (`git fetch origin`, inspect `git diff origin/main`, and reset/re-branch cleanly onto `origin/main` without losing local uncommitted work or `MUHS-Papers.apk`).
2. **Non-interactive `git push` Hang:**
   - Running `git push` from a non-interactive background shell hung waiting for Windows Git Credential Manager without showing a UI prompt. The user or OpenCode should either run `git push` in an interactive terminal or authenticate Git/GitHub CLI (`gh auth login`) first.
3. **`seedDefaultPapers()` Only Seeds Once (`muhs.seeded.v1`):**
   - Anyone who already visited `https://kodestien234.github.io/muhs-papers/` or `http://localhost:4173/` has `localStorage["muhs.seeded.v1"] === "1"` and the old `gdrive_*` records in IndexedDB. When replacing Drive links with site-hosted PDFs, bump the seed key (e.g., `muhs.seeded.v2`) and remove obsolete `gdrive_*` entries on upgrade while keeping user-added papers/bookmarks intact.
4. **`safeUrl()` & `kind: "link"` Assumptions in `app.js`:**
   - `safeUrl()` currently rejects relative paths (`papers/...`).
   - `downloadPaper()` for `kind === "link"` uses `target="_blank"`, and `openPreview()` shows `"Some sites block embedding"` for all `link` papers. Needs clean handling for site-hosted local PDFs.
5. **Previous Drive Source Anomaly (`MICROBIOLOGY - II [2023].pdf`):**
   - In the earlier Phase II Drive folder (`1LWxBmHtJ-DJB_G1x04q7tb3aU9RoWVcm`), file `1kv0riz2lutYDU2NvLxv6s0OPMs8CBctq` (`MICROBIOLOGY - II [2023].pdf`) actually contained a scan of Paper I (`N - 6023`). Check the new folder's files for similar scan/filename mismatches when sorting!
6. **Capacitor `exportLibrary()` Blob Download:**
   - `exportLibrary()` triggers `<a href="blob:..." download="...">`, which works in browsers; in Capacitor Android WebView, large `blob:` downloads may need `@capacitor/filesystem` + `@capacitor/share` if in-app backup export is desired on Android.
7. **Port `4173` May Already Be Occupied:**
   - A background `node server.js` instance was already running on port `4173` outside this session during earlier checks (`EADDRINUSE` when starting a second instance).

---

## 9. Important Technical Decisions & Reasoning

1. **Zero-dependency static site + `data.js` default papers:**
   - Kept the app free of build tools (`npm start` is just `node server.js`) so GitHub Pages serves directly from `main` `/ (root)` with `.nojekyll`.
2. **Using `drive.google.com/file/d/<id>/preview` temporarily (now being replaced per user request):**
   - `/preview` allowed iframe embedding where `/view` blocked framing. Now the user explicitly wants **direct site-hosted PDFs** instead of Drive embeds.
3. **Why GitHub Actions was chosen to build `MUHS-Papers.apk`:**
   - The local Windows machine has Node.js (`npm`/`npx`) and Git `2.54.0`, but **no JDK, Gradle, `adb`, or Android SDK**. Using `ubuntu-latest` with Java 21 + preinstalled `sdkmanager` (and removing `android-actions/setup-android@v3`, which failed on deprecated `'tools'`) built the APK cleanly in ~2 minutes.
4. **Why `sw.js` uses Network-First with Cache Fallback:**
   - Ensures GitHub Pages updates propagate immediately when online while keeping the shell functional offline (note: do **not** pre-cache 170 PDFs inside `sw.js` `install` `ASSETS`, or first-visit Service Worker install will download ~500 MB!). Cache PDFs on-demand if cached at all, or only cache the app shell in `sw.js`.

---

## 10. Development Environment & Commands

- **OS:** Windows (`C:\MUHS APP`)
- **Installed Tools Verified:** `node` (v24.11.0), `npm` / `npx`, `git` (`2.54.0.windows.1`, global `user.name` / `user.email` configured).
- **Not Installed Locally:** `gh` (GitHub CLI), `java`, `javac`, `gradle`, `adb`, Android SDK.

### Key Commands
```powershell
# Run local static server (http://localhost:4173)
npm start

# Syntax-check JS files
node --check app.js
node --check data.js
node --check sw.js
node --check server.js

# Prepare Capacitor www/ bundle and sync android/
npm run build:web
npm run cap:sync
```

---

## 11. Testing & Build Status

- **Latest Deployed Commit on GitHub (`main`):** `5cfe11a` (`index.html`, `app.js`, `sw.js` — light theme default + mobile UI + per-PDF download button).
- **GitHub Pages (`pages build and deployment #7`):** **Success** — live at <https://kodestien234.github.io/muhs-papers/>.
- **Live Browser Verification (`390×844` & desktop):**
  - `0` failed network requests (`HTTP 200` on `/`, `styles.css`, `app.js`, `data.js`, `icon.svg`, `fonts/open-sans.woff2`, `sw.js`).
  - `0` app console errors.
  - Verified `data-theme="light"` default, dark/light toggle, zero mobile horizontal overflow (`375.2px <= 390px`), aligned 2-column filter grid, 4-button paper rows, modal footer visibility, and side-by-side preview footer buttons.
- **GitHub Actions APK Build (`Build Android APK #4` at `5cfe11a`):** **Success** (1m 54s). *(Note: local `C:\MUHS APP\MUHS-Papers.apk` was downloaded earlier from build `#2` / `1970543`.)*

---

## 12. Exact Stopping Point & Immediate Next Steps for OpenCode

### Where We Stopped
- We received the user's new Google Drive link (`https://drive.google.com/drive/folders/11wVsDhJ-vFwgIEJ_PYQYjV63LWYq6Zhy`, **"MUHS MBBS Exam old Question Paper"**) and crawled **100% of the folder tree** via browser inspection.
- **Completed:** Full inventory of all **14 subject folders**, **105 subfolders**, and **170 PDF files** (with exact Google Drive file IDs and sizes listed in Section 13 below).
- **Stopped right before:** Downloading those 170 PDFs locally, inspecting their pages to verify exact Subject / Paper 1 vs 2 / Summer vs Winter / Year, saving them directly into the repo, updating `app.js` & `data.js` to serve site-hosted PDFs without Drive embeds, and pushing to GitHub Pages.

### Recommended Execution Plan for the Next Agent
1. **Sync local git with `origin/main` first** (fetch `origin`, check diffs against `origin/main`, reconcile commit history).
2. **Batch-download all 170 PDFs** from the IDs in Section 13 using `https://drive.google.com/uc?export=download&id=<FILE_ID>` (note: Drive files up to ~18.7 MB downloaded directly in Node without needing confirm tokens during earlier Phase II tests; verify `%PDF-` header on every downloaded file!).
3. **Check file sizes & total repo size** (estimated ~450–550 MB total; check `Old Question Paper.pdf` files in each folder — they appear to be ~6–17 MB multi-year compilations, and check files with missing `.pdf` extensions like `Physiology Paper-I Summer-2025`, `Biochemistry Paper-1 Summer 2025`, `MCQ 2024`, `General Surgery Paper I Winter 2021`, `Forensic Medicine & Toxicology MCQs-2025`, `Pathology Paper I Winter 2024 MCQs`).
4. **Inspect PDF headers/text** (via PDF text extraction or rendering page 1) to accurately assign `subjectId`, `paperNumber` (`1`, `2`, or `null` for combined files), `session` (`Summer`/`Winter`), `year`, and clean `title`. Decide with the user if needed whether to keep or merge the earlier 54 Phase II papers (`Winter 2017`–`2023`, etc.) with these 170 papers (`14` subjects!).
5. **Update `app.js` & `data.js` for direct site-hosted PDFs**:
   - Store PDFs under e.g. `papers/<subjectId>/<clean-filename>.pdf`.
   - Support relative same-origin PDFs cleanly in `app.js` (render `PDF` badge + size, embed directly in `<iframe>` without the `"Some sites block embedding"` note, and download directly via `<a download>`).
   - Bump `SEEDED_KEY` (`muhs.seeded.v2`) and replace old `gdrive_*` links cleanly on boot.
   - Keep `sw.js` caching only the app shell (never pre-cache 500 MB of PDFs on SW install).
6. **Commit & push to `github.com/Kodestien234/muhs-papers` (`main`)**, confirm GitHub Pages deployment succeeds, and test preview + download of site-hosted PDFs live on `https://kodestien234.github.io/muhs-papers/`.
7. **Handle APK exclusion/fetching** in `scripts/prepare-www.js` before rebuilding the APK later (do not bundle 500 MB of PDFs into `www/` unless explicitly requested; instead keep `MUHS-Papers.apk` pointing to/fetching from `https://kodestien234.github.io/muhs-papers/papers/...` or ask the user).

---

## 13. Complete Inventory of New Drive Folder (`11wVsDhJ-vFwgIEJ_PYQYjV63LWYq6Zhy`) — 170 PDFs

> Direct download URL pattern for every ID below: `https://drive.google.com/uc?export=download&id=<FILE_ID>`

### 1. `1.Anatomy` (`anatomy` — 12 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1AFCMv_WYtv_03m9Kb_xVtwBTJRjvEi7T` | 13.7 MB |
| `MCQ/` | `MCQ Summer 2024.pdf` | `1xbW4Kf5B4bf76u7FMqkAbNCow69TprnY` | 5.3 MB |
| `Summer 2020/` | `Anatomy.pdf` | `1QAiSdvoTVBGlOxmpGQjChYbyi6rNzJ33` | 1.4 MB |
| `Summer 2022/` | `Anatomy Summer 2022.pdf` | `1dxvBKUOZo-8M3R3KUo-qoNu8rh6zhz2L` | 2.5 MB |
| `Summer 2024/` | `1st MBBS Anatomy Paper II  Summer 2024.pdf` | `1jCnOKQBCNrhuUjasHhr4BRc3gmjU10Jr` | 5.1 MB |
| `Summer 2024/` | `Anatomy Paper II Summer 2024.pdf` | `12-dSTCUnPHr6cECPJ6RPfRynIQUNQMpF` | 5.3 MB |
| `Summer 2024/` | `Anatomy Paper-I Summer 2024.pdf` | `1IrrRzFZiKhBlDWwq_uA4JUb8TjLC30D0` | 6.8 MB |
| `Summer 2025/` | `Anatomy Paper-I Summer 2025 CBME.pdf` | `17Gj_prKz90yYqZgcJ0Rd8ZRkrRFNiOKx` | 2.2 MB |
| `Winter 2021/` | `Anatomy-I Winter 2021.pdf` | `1-EdgxKPSAC4pMydNvrqjCTn3gxax0hZr` | 925 KB |
| `Winter 2021/` | `Anatomy-II Winter 2021.pdf` | `12WDyuE6K2KQk9iiIuXlREAxFbClzWHLF` | 1.2 MB |
| `Winter 2022/` | `Anatomy Winter 2022.pdf` | `1U2hSxo3wFJB-nw4qIbjplgQU_HEE2zP9` | 6.8 MB |
| `Winter 2023/` | `Anatomy Paper II Winter 2023.pdf` | `1O2Kbpur3319AhhssJXghZiUHBAy3Rnk6` | 392 KB |

### 2. `2.Physiology` (`physiology` — 16 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1IY7B3Xwsy84i8aDG_krdL5Ol1f1G4EDo` | 13.5 MB |
| `Summer 2020/` | `Physiology 2020.pdf` | `1RIJkwIvp-SX5eqQziLJA4oYYRjePxpDf` | 1.4 MB |
| `Summer 2022/` | `Physiology Summer 2022.pdf` | `1Pk2XhdVmE6N49svPopl9oFYD04GeMg6V` | 2.9 MB |
| `Summer 2024/` | `Physiology Paper-I Summer 2024.pdf` | `1PDLApsf4uwepKLPOsaCIuWS2_LGAKAKa` | 5.2 MB |
| `Summer 2024/` | `1st MBBS Physiology Paper I Summer 2024.pdf` | `1DVcaTc71JTW6K6iOh7cJ3GeaxQ6xJHMz` | 5.2 MB |
| `Summer 2024/` | `Physiology (CBME-2023)Summer 2024 Paper-I.pdf` | `1NRP2dz87n0YWQ6I-6aqZsO5P3ApCqB6e` | 1.3 MB |
| `Summer 2024/` | `Physiology First MBBS Paper I Summer 2024.pdf` | `1SBw4uffnxk2Lxc_yEu0jawxacxo_tNMf` | 5.6 MB |
| `Summer 2024/` | `Physiology Paper I Summer 2024.pdf` | `1PJ5UVuy_XbkDpeh6KpQ4G4hdWJ8MbiP_` | 6.4 MB |
| `Summer 2024/` | `Physiology Paper II Summer 2024 MCQs.pdf` | `1zk4KcmUW4kXm6LhG9xSVKwy6No6F-Xtr` | 10 MB |
| `Summer 2024/` | `Physiology Paper II Summer 2024.pdf` | `1zqHWrKW16L5aiRH5cqzDdnZGE0wQzvFp` | 6.6 MB |
| `Summer 2024/` | `Physiology Supplementary Summer 2024 Paper-I.pdf` | `1Cz1srziWb4mjDCjM2Ouzjn8YTEe4xHS6` | 2.6 MB |
| `Summer 2024/` | `Physiology Supplementary Summer 2024 Paper-II.pdf` | `174MNBoFL6ORPO2NINu8rTMUeOtFLqs3K` | 1.5 MB |
| `Summer 2025/` | `Physiology - I.pdf` | `1_CWjbkI0V32TCaTKNAsk2mS_XVWkXV_k` | 2.7 MB |
| `Summer 2025/` | `Physiology Paper-I Summer-2025` | `1DN5mQ8XuQBshgSPOWqH1bEUqSv8gkPoQ` | 2.6 MB |
| `Winter 2021/` | `Physiology Winter 2021.pdf` | `15Cj-04LLLsRAodyrwgrxXvasWuESTcAR` | 2.7 MB |
| `Winter 2022/` | `Physiology Winter 2022.pdf` | `1cFNpIUPVrh6ePmV-xk_Xcfal3UbPSDy3` | 8.1 MB |

### 3. `3.Biochemistry` (`biochemistry` — 12 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1OGe9vUxRcHUU03nYiNmpZ4LEbvYPwzto` | 16.5 MB |
| `MCQ/` | `Biochem II paper.pdf` | `1zYcyUh9Wk0kbSe-Qzer7BhDx0cuf_6n7` | 4.5 MB |
| `Summer 2020/` | `Biochemistry 2020.pdf` | `1tD3KiUcaF6iRaVL46_AEf86_rUxTygFb` | 1.4 MB |
| `Summer 2022/` | `Biochemistry Summer 2022.pdf` | `1MCPAl0WGfJu5OFWbMqiuIZ8nDth4A8Dk` | 2.8 MB |
| `Summer 2024/` | `Biochemistry Paper II Summer 2024.pdf` | `1r11WhfexLEeaQ2aT--Taa4sgHlj68dl-` | 4.5 MB |
| `Summer 2024/` | `Biochemistry Paper-I Summer 2024.pdf` | `1fOuC0HhgX5tOndSjn0XGRecJyhtwg4Vl` | 2.4 MB |
| `Summer 2025/` | `Biochemistry Paper-1 Summer 2025` | `1edqn0nSbROkculm2qg8qXwCxIgi6L0D6` | 2.3 MB |
| `Summer 2025/` | `Biochemistry Paper-II Summer 2025` | `1HJ8_wLQiFSQyQT1XWi6tcoUVKzEn4FIx` | 2.1 MB |
| `Winter 2021/` | `Biochemistry Winter 2021.pdf` | `1Zk0fzYxbG4nXkoGJgk2AY_2JxbE1KJXc` | 1.8 MB |
| `Winter 2022/` | `Biochemistry Winter 2022.pdf` | `1j178iUrsFVI_JvqC8fEpKaifr_CrDXEq` | 10.4 MB |
| `Winter 2023/` | `Biochemistry Supplementary Winter 2023 Paper-I.pdf` | `14_Y0flx_HoF47TRwny8F6D6XvsKBsFhN` | 1.6 MB |
| `Winter 2023/` | `Biochemistry Supplementary Winter 2023 Paper-II.pdf` | `1eALjvmpJrInSVr_XAezqTiWQA7Xkf4KP` | 4.9 MB |

### 4. `4.Pathology` (`pathology` — 9 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1D7XzyBU4cL8ZIZ2XhbvS55dFCBYEqLb2` | 14.2 MB |
| `Summer 2021/` | `Pathology Summer 2021.pdf` | `1Vv71Ljd4BeryTLDrSgRoO8wUNQFShLzT` | 1.7 MB |
| `Summer 2022/` | `Pathology ( Old ) Summer 2022.pdf` | `1_KWukSYxCvJDoMclzl3dSiq9zKuqJPfk` | 1.5 MB |
| `Summer 2022/` | `Pathology Summer 2022.pdf` | `1VxrQU3Ssco6mghRV4T9QxomWpyPPvepT` | 2.2 MB |
| `Summer 2023/` | `Pathology Summer 2023.pdf` | `13cChRKAkQptbQIl7Gfn8amORNTLiJ9qc` | 6 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1E9icKwv8EqjnE4pFHU5xWai7Yi9YCTQw` | 645 KB |
| `Winter 2021/` | `Pathology Winter 2021.pdf` | `1YXEWSinzWnlbXVDKVC_HcF9cEcKtfJbC` | 1.4 MB |
| `Winter 2022/` | `Pathology Winter 2022.pdf` | `1D6xR_mrPa2uxGAJtLVO7owpumvfbXiko` | 18.7 MB |
| `Winter 2024/` | `Pathology Paper I Winter 2024 MCQs` | `1s7KTW5B8pNSFKZhb1fflz6EnqfGsnQQB` | 7.1 MB |

### 5. `5.Microbiology` (`microbiology` — 13 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1ODGirgzSUBP8LBQyVFhvbfAKctMfK0uK` | 13.2 MB |
| `2025/` | `Microbiology  Paper I Jan2025 MCQs.pdf` | `16mEjJ0yrxJesQDlf1sVvV3FCm_J3nhfe` | 1.4 MB |
| `2025/` | `Microbiology Paper -II Jan 2025 MCQs.pdf` | `1bGzDdOXOghOWfgSJOprMTf8x1TG61P3o` | 1.4 MB |
| `MCQ/` | `MCQ 2019.pdf` | `1K_Fd4cK1N9OJEiVm_OgFe2uvHBxFRKfs` | 1.4 MB |
| `MCQ/` | `Microbiology Second MBBS Paper I.pdf` | `1RjU1U96yZ5bd2pq23eWh_WACQO4P4MGA` | 1.4 MB |
| `MCQ/` | `Microbiology Second MBBS Paper-II.pdf` | `1bhRGviZ4ZF4m14AKnjrNgYzG2IWiRJSJ` | 1.4 MB |
| `Summer 2021/` | `Microbiology Summer 2021.pdf` | `1jQISwmBuvfArmGwTFKTKZgavAn1aymQg` | 1.6 MB |
| `Summer 2022/` | `Microbiology (Old) Summer 2022.pdf` | `1U550n6FG1RnD618Rn8CzHmFzWH4mZxzQ` | 1.5 MB |
| `Summer 2022/` | `Microbiology Summer 2022.pdf` | `1BxxQ68FwYqxs0qJHf9aBvJs54wKxHXsI` | 2.7 MB |
| `Summer 2023/` | `Microbiology Summer 2023.pdf` | `1i5RTsb3X7rE1LyoSoxJy3PzjcHfGDTFf` | 5.4 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1FAujxGsxNz65cJp6I1NqhvRhjZ7G8Tj6` | 645 KB |
| `Winter 2021/` | `Microbiology Winter 2021.pdf` | `17BOzQechKdpS3Y3rMyCcYQgbOF97oHtU` | 2.1 MB |
| `Winter 2022/` | `Microbiology Winter 2022.pdf` | `1YukekUS5nYU1mIFA9oStYXgzjIXqeoPg` | 7.3 MB |

### 6. `6.Pharmacology` (`pharmacology` — 15 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `old Question Paper.pdf` | `1-k0U70A_XyFIhVizUraBuwytzbiHD-zV` | 13.6 MB |
| `Summer 2021/` | `Pharmacology and Therapeutics Summer 2021.pdf` | `1BaT0H9c40obA99j_SDVEpQEp9Mp3XGDR` | 1.5 MB |
| `Summer 2022/` | `Pharmacology and Therapeutics Summer 2022.pdf` | `1kyFZNXXPnGagbqMq0ki5a5xhIc82YeAQ` | 1.5 MB |
| `Summer 2022/` | `Pharmacology Summer 2022.pdf` | `16ZXlM_t3nQsmrPNXyavZFEHhCbkkdxV-` | 2.2 MB |
| `Summer 2023/` | `Pharmacology Summer 2023.pdf` | `1bR9-jMCBmJ_G4Z-Fp5km4Sb-LS_41mi1` | 6.2 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1-_e-teHALKaHy7zyInL9rFw7QCdvhnDK` | 725 KB |
| `Winter 2021/` | `Pharmacology and Therapeutics- II Winter 2021.pdf` | `1lbzGI6ly24VikQl7BLY8hqD7suL1Zzy6` | 719 KB |
| `Winter 2021/` | `Pharmacology and Therapeutics-I Winter 2021.pdf` | `1maE-XZ9w6OUXSoK1FSUyT78Z4bCZzFQ-` | 762 KB |
| `Winter 2021/` | `Pharmacology Winter 2021.pdf` | `1ydsrGa3bxbeLJk6Be0fvqlZ4Ne5z8u8J` | 1.9 MB |
| `Winter 2022/` | `Pharmacology Winter 2022.pdf` | `1GXJQuthg-1pUoBkA44Ixn6vjFx0bMKrT` | 13.8 MB |
| `Winter 2023/` | `Pharmacology & Therapeutics Winter 2023 Paper-I.pdf` | `1bQmzNV4Mmzu5OPPZPI-PiOoR6ZApbGqd` | 858 KB |
| `Winter 2023/` | `Pharmacology & Therapeutics Winter 2023 Paper-II.pdf` | `1U9CTXs74UJvOTAKQDXsLT3UJ3h3ued3o` | 836 KB |
| `Winter 2023/` | `Pharmacology Winter 2023 Paper-I.pdf` | `1qDm2VUL672mBAoVqyGCPLYzzvD2BfMae` | 1 MB |
| `Winter 2023/` | `Pharmacology Winter 2023 Paper-II.pdf` | `1zQgpxY5NvfbQYPKzM42t8ZzSkFkgjnND` | 1,009 KB |
| `Winter 2024/` | `Pharmacology Winter 2024 Paper I.pdf` | `1RTtvX1n3WJFR8LI0rhyPpaepn3Qkq-T6` | 1.7 MB |

### 7. `7.Forensic Medicine & Toxicology` (`forensic` — 10 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `old Question Paper.pdf` | `116JgzIQqpxBhHYZm9c9Yz1xbplr31j6W` | 6.9 MB |
| `2025/` | `Forensic Medicine & Toxicology MCQs-2025` | `1T_niN_JEmvNDxUWClR2Ke3wp7TXukrK8` | 2.4 MB |
| `Summer 2021/` | `FMT Summer 2021.pdf` | `1HBOs4TreNLzIfxIlfUHncXNrnx0hFpxp` | 708 KB |
| `Summer 2022/` | `FMT Summer 2022.pdf` | `16Eq_EPYdp1AEGfT8XO9QbPLUQUWYh56U` | 794 KB |
| `Summer 2023/` | `FMT Summer 2023.pdf` | `12RwLqOg9E5iQDAPiop0IQhVzyeKVjBpg` | 3.4 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1uGQl9cwA5u8Giq3EE-GQpvN0nRNl_LiN` | 310 KB |
| `Winter 2021/` | `FMT Winter 2021.pdf` | `1Nj07GGZeLGZxAzBhfYJnyuS6GPuL8pJx` | 713 KB |
| `Winter 2022/` | `FMT Winter 2022.pdf` | `1TE4ofU6DVfFc6RdsIfi6uO9Mb11Of_C2` | 2.7 MB |
| `Winter 2023/` | `Forensic Medicine & Toxicology Winter 2023 Old.pdf` | `1AvQ92ERD28EPspvhzd9fGVULtr7Ew--0` | 194 KB |
| `Winter 2024/` | `Forensic Medicine & Toxicology MCQs Winter 2024.pdf` | `1s2YKCIpvxFh8h0eIFWNdTMsDHvy25QSf` | 2.7 MB |

### 8. `8.Community Medicine` (`community` — 16 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1AKk82Qhp-cjId2xvoI3NEi24lioPTy9I` | 16.5 MB |
| `MCQ 2020/` | `MCQ 2020.pdf` | `1wMKbZND9D3wL9wzq36LesV9cOYiuIc8F` | 2.4 MB |
| `MCQ 2024/` | `MCQ 2024` | `1UG8kokwv4ymIhIvzv-Li1RGjHnBSdn8A` | 3.1 MB |
| `MCQ 2024/` | `MCQ 2024.pdf` | `1cl4N5-aU8k2Lrr5L7iDFk-MFLmlWEpuL` | 1.1 MB |
| `Summer 2021/` | `Community Medicine Summer 2021.pdf` | `14juTlHnaYVwsrawwSFAPuJKhIfXzwy_S` | 5.6 MB |
| `Summer 2023/` | `Community Medicine Summer  2023.pdf` | `1cL5ZJYPD353ZMiEclKnFhoYnRa7DRO7K` | 5.8 MB |
| `Winter 2020/` | `Winter 2020 ( MCQ).pdf` | `1OlFkQOJTshepUm0CwTBDK0CLGGao8ZTw` | 3 MB |
| `Winter 2020/` | `Community Medicine Winter 2020.pdf` | `1bACbe4AflMDx-AMzaSP4rbPNT2xKuFx3` | 7.8 MB |
| `Winter 2021/` | `Community Medicine Winter 2021.pdf` | `1M4d6GbH5Jl2BWm8zjTr8FZi7UWVuJSKK` | 1.4 MB |
| `Winter 2022/` | `Community Medicine Winter 2022.pdf` | `148mEdlDt8x3FBGadWBhIXR2RNsQgmy4V` | 9.3 MB |
| `Winter 2023/` | `Community Medicine-Winter 2023 Old Paper-I.pdf` | `1ZECzUO1TwQMhiCqILi2_fbdAB6w2SA6m` | 767 KB |
| `Winter 2023/` | `Community Medicine-Winter 2023 Old Paper-II.pdf` | `1LaJiWtjcyTW50VAEn2iGbP23tIBnUpC3` | 936 KB |
| `Winter 2023/` | `Community Medicine-Winter 2023 Paper-II.pdf` | `1g4Li3Trmxd9oMBbocznM8f78uOQMZaJk` | 1.4 MB |
| `Winter 2024/` | `Community Medicine Paper I Winter 2024.pdf` | `1MiWrUgYZvyaLlRckoq0V3R37LAdFDNd5` | 4.2 MB |
| `Winter 2024/` | `Community Medicine Paper II Winter 2024.pdf` | `1hRy7EbYTBgARgwkwjw5F2iH95Y7Brlsi` | 3.1 MB |
| `Winter 2024/` | `Community Medicine Winter 2024 Paper II.pdf` | `1DgYJX_63r8WyW_xlwCKjwPBEImAjUQSg` | 1.1 MB |

### 9. `09.ENT` (`ent` — 8 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old QuestionPaper.pdf` | `1DDFd37hmGkyRJ9_Kyyi1Xqv8ogJMiRLE` | 5.8 MB |
| `MCQ 2020/` | `MCQ 2020.pdf` | `1bgrisOAg6vPcHbIEz2qdB2j3WtvIOfa3` | 1 MB |
| `Summer 2021/` | `ENT Summer 2021.pdf` | `1YKEfZ0ewiNDRDEH-riadUZYbyOXmN2GI` | 641 KB |
| `Summer 2023/` | `Otorhinolaryngology Summer 2023.pdf` | `1iAKG8g8pCcdvv2TcGyrDJWI95xICrSPS` | 3.9 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1KSBlRz2ORrVC3r5Yz6h7MT7F266_X5qk` | 263 KB |
| `Winter 2021/` | `ENT Winter 2021.pdf` | `1FUj3iAhclbgzM0TURLk2ZXgSr3Hwb2xS` | 707 KB |
| `Winter 2022/` | `ENT Winter 2022.pdf` | `1HpzvUL4R5vLd0xCb7cqiKGovp0oK7tZ1` | 7.3 MB |
| `Winter 2024/` | `ENT Winter 2024 MCQs .pdf` | `149UMZkpU4G5Y6c5MfkW3OJQxt9THo3gZ` | 3 MB |

### 10. `10.Ophthalmology` (`ophthalmology` — 10 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1hktAavK513VmM8IPjNp2_8QdQf_dXwmb` | 8.8 MB |
| `MCQ 2020/` | `MCQ 2020.pdf` | `1i7ifDpVjf8bdQSIOl78ZFkhc_kQujWKX` | 777 KB |
| `Summer 2021/` | `Ophthalmology Summer 2021.pdf` | `1qUs6IKwQep-Omw1D2HiFZZ61t53levDP` | 721 KB |
| `Summer 2023/` | `Ophthalmology Summer 2023.pdf` | `1ZIhD_SHOj7VxqwjA5VdO5zP2iFGYMIgw` | 2.7 MB |
| `Summer 2024/` | `Ophthalmology Summer 2024 Old MCQs.pdf` | `1OhIE9Or0bUaBlkqiHqmkBAS3nG0yGVIg` | 1.3 MB |
| `Winter 2020/` | `Ophthalmology Winter 2020.pdf` | `1KYeXe-FFK1bMNLRjlsIvyYyEAzJiYyCD` | 2.9 MB |
| `Winter 2021/` | `Ophthalmology Winter 2021.pdf` | `1umtJBHPM0uLg-4EVXdkN5eYpvS9ZBBPv` | 619 KB |
| `Winter 2022/` | `Ophthalmology Winter 2022.pdf` | `1t4aXgO9jwulF6zT7uFG06GC82iOmr7GZ` | 2.5 MB |
| `Winter 2023/` | `Ophthalmology Winter Old-2023.pdf` | `1enz7mJu9s5ZTIyUOTjRmN88nPWUlLNZp` | 648 KB |
| `Winter 2023/` | `Ophthalmology Winter-2023.pdf` | `1OZm9WVQilibKZYdD1zqWngzYVx4IY2QJ` | 1.3 MB |

### 11. `11.OBGY` (`obgyn` — 13 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1FyjxWWc3TsTKj4VQrG9X8_Y_yzs5SEh2` | 15.6 MB |
| `Summer 2022/` | `Obstetrics and Gynaecology Summer 2022.pdf` | `1iABfMnb9hiVcgNA4Rt81WstF6HSa9cpG` | 783 KB |
| `Summer 2023/` | `OBGY Summer 2023.pdf` | `19PvXzdPsfsJPlsX2lM1sIB9ltRM-Y-nv` | 3.8 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1OXGV5-Xp3QujxFsRMjrhW2tJyj1VJ6Jo` | 2.1 MB |
| `Winter 2021/` | `Obstetrics & Gynecology Paper II Winter 2021.pdf` | `1vVclS3qvtZmmRqwZaK5Y00Pp-JUOvO1H` | 145 KB |
| `Winter 2021/` | `Obstetrics and Gynaecology Paper I Winter 2021.pdf` | `1qhPoSIME-iQL2r7m6fDpQDcGvXhVz2SH` | 1.3 MB |
| `Winter 2022/` | `Obstetrics & Gynaecology Winter 2022.pdf` | `1TVbXNKpd0-0N_EtRh75b2UOgkd_k3x79` | 4.2 MB |
| `Winter 2023/` | `Obstetrics & Gynecology Old -Winter 2023 Paper-I.pdf` | `1fnV8Kgd0rYgX8aXPNw5Fsn72RZwrvIWX` | 736 KB |
| `Winter 2023/` | `Obstetrics & Gynecology Old -Winter 2023 Paper-II.pdf` | `1pNDWHrXbnrN-yXVH9fxDXeXWLOW9oCcR` | 655 KB |
| `Winter 2023/` | `Obstetrics & Gynecology-Winter 2023 Paper-I.pdf` | `1EcUWTTBfyMbNPtny2E_lMpK8LN4Wr-eg` | 1.1 MB |
| `Winter 2023/` | `Obstetrics & Gynecology-Winter 2023 Paper-II.pdf` | `10XAT50jx4_EqNlnodD6cAnsEDdSg_Xxd` | 983 KB |
| `Winter 2024/` | `OBGY Paper I Winter 2024 MCQs.pdf` | `18fQfNauR3Oai4jS_pzEMEOzxHKMJ_aMR` | 2 MB |
| `Winter 2024/` | `OBGY Paper II Winter 2024 Old MCQs.pdf` | `1F8O6G-aGJjnqgVSpwkdxQfmLyEwnHJH_` | 934 KB |

### 12. `12.Pediatrics` (`pediatrics` — 11 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `Old Question Paper.pdf` | `1YKGjQFXGRjinjiU6LSI9cuEWxwVAe1fw` | 8.5 MB |
| `/` | `Peadiatric Multiple Choice Feb 2025.pdf` | `1HAVEAHwuLFAWVyryJYJ0tMAprmDqBt5h` | 723 KB |
| `Summer 2022/` | `Paediatrics Summer 2022.pdf` | `1TJkqwAumPXZTEgEpiuz5SZLlYJOU7dqw` | 767 KB |
| `Summer 2023/` | `Paeditrics Summer 2023.pdf` | `1KX1r1s4XC9ZKUtNe0cgRIbf94Ih3LiLv` | 2 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1xeNdYOlusNGQ3tY6TWxEtDv1v93UH89w` | 1.1 MB |
| `Winter 2021/` | `Paediatrics Winter 2021.pdf` | `1FAIQblp4PuxsM6vA97qnx4wOtXCCQj3Y` | 618 KB |
| `Winter 2022/` | `Paediatrics Winter 2022.pdf` | `1vZA1KumTkr46YHJFtYlTrOs-Os64nCLI` | 1.8 MB |
| `Winter 2023/` | `Pediatric Winter 2023.pdf` | `1RAtuFetaO6bQxuUfMKMTuRvbSH95jezM` | 1.2 MB |
| `Winter 2023/` | `Pediatric Winter Old-2023.pdf` | `12xdz1kJotYNZvG2xgq6SvsC5CePaxHH0` | 640 KB |
| `Winter 2024/` | `Pediatric Final MBBS-Winter 2024.pdf` | `1Tv1_aLkTAJ2nqLKMlja8JPdzHYOBqvLt` | 3.3 MB |
| `Winter 2024/` | `Pediatric Winter 2024 Multiple Choice Q.pdf` | `19zPCoH293aF_fDxbJ3iPVBtZE7wGOFsw` | 1.1 MB |

### 13. `13.Surgery` (`surgery` — 12 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `General Surgery Final MBBS Paper II.pdf` | `1YVJTvLW4ZMpJScKaBSq4XE6hGeHCFfSt` | 1.5 MB |
| `/` | `Old Question Paper.pdf` | `1JXph4u9565KF100Ek6atnOyczXZNn3wF` | 17 MB |
| `Summer 2022/` | `General Surgery Summer 2022.pdf` | `12pRvQkK5b9iMcraR2SCzOoMg-xsFKCfu` | 1.6 MB |
| `Summer 2023/` | `General Surgery Summer 2023.pdf` | `1iWRrTGW1cz1DyMZTZyaosDe76cDlVW3f` | 5.7 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `144HlO-ek3jjkg9wvQOMtsfgdLmb2uOTq` | 4.6 MB |
| `Winter 2021/` | `General Surgery Paper I Winter 2021` | `1SOnrx04lBgc35eMGqa-PjyOG8_eIAVjn` | 1.5 MB |
| `Winter 2021/` | `General Surgery Paper II Winter 2021.pdf` | `1aPAhM38KDtS4Z08DbFdNRn_fd6XHpeBH` | 246 KB |
| `Winter 2022/` | `General Surgery Winter 2022.pdf` | `16S6Kip4WF6M_2u3Lb1K4MKQ5ve9KmzNE` | 5.7 MB |
| `Winter-2023/` | `General Surgery Winter-2023 Paper -I.pdf` | `1zG5AIkq0Msl3m3PhJhg_smsktCZgxc00` | 1.1 MB |
| `Winter-2023/` | `General Surgery Winter-2023 Paper-II.pdf` | `1-bvlxan9BrxK4eRpwOptbPx605bFboyZ` | 1.2 MB |
| `Winter-2023/` | `Genral Surgery Winter Old -2023 Paper-1.pdf` | `1M2iNzkzKO_jWHBMcGqGb08i1M9kjn1iG` | 762 KB |
| `Winter-2023/` | `Genral Surgery Winter Old-2023 Paper-II.pdf` | `1QwIdH_RUIRkY5A53JuUEe52caecQxNd6` | 712 KB |

### 14. `14.Medicine` (`medicine` — 13 PDFs)
| Subfolder | Filename | File ID | Size |
| --- | --- | --- | --- |
| `/` | `General Medicine Paper I MCQs.pdf` | `1kBRIxj-f3o0Xxb0hoW0CZiTiceyDMmFn` | 1.3 MB |
| `/` | `Old Question Paper.pdf` | `1F9FmghxcScvBaahhsoAyhQcAQIZcytSx` | 15.7 MB |
| `2025/` | `Medicine Paper II UG Feb 2025 MCQs.pdf` | `1WFGWTAkT-ow9OK_PStTQb15XgnOzkm8H` | 702 KB |
| `Summer 2022/` | `Medicine and Allied Subjets  Summer 2022.pdf` | `1N2E_G3PlKmNjriqwJgjB0eBIi0L0t9KF` | 1.7 MB |
| `Summer 2023/` | `Medicine & Allied Subjects Summer 2023.pdf` | `1iLNOaC9rVx1mvqz10e83oxLoCuayIFdc` | 6.3 MB |
| `Winter 2020/` | `Winter 2020.pdf` | `1gNCFb5xoTcWq9LwZEUz85yN0phX_GvZt` | 4.5 MB |
| `Winter 2021/` | `Medicine and Allied Subjects Winter 2021.pdf` | `1PDaZdCL41apErpOSRfZxnw1XFa2gl3iQ` | 1.5 MB |
| `Winter 2022/` | `Medicine & Allied Subjects Winter 2022.pdf` | `1igHGK6Jvd2xEd52GdMd937bS4N9dTw6z` | 7.4 MB |
| `Winter 2023/` | `General Medicine-Winter 2023 Paper-I.pdf` | `16MFeS-IYXbuz95Bce6jD9Vty_aIc0Fd8` | 2.3 MB |
| `Winter 2023/` | `General Medicine-Winter 2023 Paper-II.pdf` | `1g_4-N9FWjd1hKSnvOzArEEBuPwX8xdfc` | 2.1 MB |
| `Winter 2023/` | `Medicine & Allied Subject-Winter-2023 Paper-I.pdf` | `1xCAJEqB-F3IkCkBPRPPgOcNM0ovkbRNq` | 714 KB |
| `Winter 2023/` | `Medicine & Allied Subject-Winter-2023 Paper-II.pdf` | `1fwWpjAL_1bnuGgF1zoRxFRUmahKKWdyY` | 1 MB |
| `Winter 2024/` | `General Medicine Paper II Winter 2024 Supply.pdf` | `1-0czZ9f9wBKgYbfvZ2LHEZ7wb74JhabS` | 2.9 MB |
