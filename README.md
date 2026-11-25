# MUHS Papers

A calm, searchable library of **MUHS MBBS previous year question papers**, organised the way the university examines: phase → subject → exam session → year.

Built as a dependency-free web app. Papers are stored in your browser (IndexedDB), so the library works offline, uploads nothing, and remains private. Backups can be exported as a single JSON file — including the PDFs — and shared with classmates.

---

## Run it

```bash
npm start
```

Open <http://localhost:4173>.

`npm start` uses a tiny zero-dependency Node static server (`server.js`). You can also open `index.html` directly, but some browsers restrict IndexedDB on `file://` URLs, so a local server is recommended.

No install step, no build step, no external services.

---

## What it does

- **Browse by phase** — Phase I, Phase II, Phase III Part I and Phase III Part II, with the full MUHS MBBS subject catalogue (19 subjects).
- **Subject pages** — every paper for a subject, grouped by exam year, filterable by Summer/Winter session and year.
- **Global search** — search subjects, paper titles, years and sessions from any page (`/` focuses the search box).
- **Add papers** — upload a PDF/JPG/PNG/WEBP (up to 20 MB) or attach an HTTP(S) link. Files are stored locally in IndexedDB.
- **In-app preview** — read PDFs and images without leaving the app. External links get an "open in new tab" fallback.
- **Bookmarks** — flag papers for revision week.
- **Backup & restore** — export the whole library (files included, base64-encoded) to JSON, then import it on another device.
- **Dark mode**, responsive layout, keyboard and screen-reader friendly.
- **Sample library** — one click generates clearly-labelled placeholder papers so you can explore the interface. Remove them from **About** at any time.

---

## Adding papers

1. Open a subject (or press **Add paper** in the header).
2. Choose the subject, exam session and year.
3. Give it an optional title, then upload a file or paste a link.
4. Press **Add paper**.

The app does **not** host or scrape question papers. You add the PDFs you already have — from your college library, seniors, department notice boards, or official university releases.

### Bulk import

There is no CLI, but a backup file is just JSON. Export once to get the shape, then add entries and re-import:

```json
{
  "app": "muhs-papers",
  "version": 1,
  "papers": [
    {
      "id": "anatomy-winter-2024",
      "subjectId": "anatomy",
      "paperNumber": 1,
      "session": "Winter",
      "year": 2024,
      "title": "",
      "kind": "link",
      "url": "https://example.com/anatomy-winter-2024.pdf",
      "addedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

For local files, use `"kind": "file"` plus `"fileData": "<base64>"`, `"fileType": "application/pdf"` and `"fileName": "anatomy-winter-2024.pdf"`.

Valid `subjectId` values live in `data.js`. Imports skip duplicates by `id` and report how many entries were added or skipped.

---

## Project structure

```
index.html          Shell, header, icon sprite, theme bootstrap
styles.css          Design system, components, responsive + dark theme
data.js             Subject catalogue (phases, subjects, sessions, year range)
app.js              Routing, rendering, IndexedDB, search, uploads, previews, backup
server.js           Zero-dependency local static server
manifest.json       PWA metadata
icon.svg            App icon
subject-icons.svg   Subject SVG symbol sprite
fonts/              Local Open Sans webfont and OFL license
```

### Editing the catalogue

`data.js` is plain data. Add a subject under the right `phase`, give it a unique `id`, a short `code` (shown in the monogram), and a one-line `blurb`. The filters, add-paper form and search update automatically.

---

## Where the data lives

| Data | Storage |
| --- | --- |
| Paper metadata | IndexedDB `muhs-papers` → `papers` |
| PDF/image blobs | IndexedDB `muhs-papers` → `files` |
| Bookmarks | `localStorage` → `muhs.bookmarks.v1` |
| Theme | `localStorage` → `muhs.theme` |

Clearing site data deletes the library. Export a backup first if the papers matter.

---

## Deploying

The app is fully static. Upload the folder to GitHub Pages, Netlify, Cloudflare Pages, Vercel, or any static host. No environment variables or server runtime are required.

`server.js` is only for local development.

---

## Notes on accuracy

The subject list reflects the MUHS MBBS CBME scheme: Phase I (Anatomy, Physiology, Biochemistry), Phase II (Pathology, Pharmacology, Microbiology, Forensic Medicine & Toxicology), Phase III Part I (ENT, Ophthalmology, Community Medicine), and Phase III Part II (Medicine, Surgery, Paediatrics, Obstetrics & Gynaecology, Orthopaedics, Psychiatry, Dermatology, Anaesthesiology, Radiodiagnosis).

Exam schemes change. Cross-check the current syllabus and paper pattern with the [official MUHS website](https://www.muhs.ac.in/) and your college.

This is an independent study tool and is not affiliated with Maharashtra University of Health Sciences.
