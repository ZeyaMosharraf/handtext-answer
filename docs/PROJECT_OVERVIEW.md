# HandText — Project Overview

> **Executive Product Overview & User Journeys**  
> *Target Audience:* Product Managers, Designers, Core Engineers  
> *Last Updated:* September 2026  
> *Document Status:* Active & Canonical

---

## 1. Executive Summary

**HandText** is a high-fidelity document workstation that converts typed digital text into realistic, organic handwritten pages. Designed to alleviate the immense time burden placed on students and professionals by mandatory handwritten homework and assignments, HandText synthesizes the complex physical interactions between pens, ink, and stationery paper.

Rather than relying on basic font rendering or generic AI image generation, HandText implements a deterministic client-side typography engine, a paper ruling lattice layout system, and natural stroke-variation physics.

---

## 2. User Personas

### Persona A: The Engineering / STEM Student ("Aarav")
- **Profile**: 2nd-year undergraduate engineering student with 5 lab subjects.
- **Pain Point**: Spends 15+ hours every weekend hand-writing circuit lab records, numerical problem sheets, and theoretical homework that he already completed digitally in VS Code, Obsidian, or Word.
- **Needs**:
  - Ability to paste technical answers with tables and numbered points.
  - Authentic blue ballpoint ink on university-style ruled paper with red margin lines.
  - Page header furniture including Name, Roll Number, Subject Code, and Experiment Date.
  - Fast multi-page PDF generation ready for printer output or online submission.

### Persona B: The High School / College Student ("Maya")
- **Profile**: 12th-grade student submitting daily assignment homework.
- **Pain Point**: Wrist fatigue and repetitive strain injury from long-form essay copying.
- **Needs**:
  - Natural, slightly casual student handwriting with subtle imperfections and baseline jitter.
  - Highlighter marks and per-word ink color switching (e.g., black ink headings with blue body text).
  - Reliable autosave so drafts are never lost when switching devices or Wi-Fi networks.

### Persona C: The Academic Educator / TA ("Dr. Sharma")
- **Profile**: Teaching Assistant or Lecturer verifying student assignments.
- **Expectation**: Legible, structured student submissions with consistent page headers, page counts ("Page 1 of 4"), and proper margin alignment.

---

## 3. Core Customer Journeys

### Journey 1: Create & Export an Assignment
```
1. User logs in via Google OAuth or Email/Password.
2. User lands on Dashboard and clicks "New Project".
3. User enters Project Title ("Physics Lab 3 - Refraction") and enters the Editor.
4. User selects "Assignment Mode", typing the experiment question in the dedicated prompt box.
5. User writes or pastes the answer text into the Rich Content Editor.
6. User highlights key technical phrases, applying Bold, Black Ink, or Fluorescent Highlighter.
7. User selects "Exam Style" paper with a classic Blue Ballpoint ink from the Design Inspector.
8. User configures Header Band with Student Name, Roll Number, and Subject.
9. User clicks "Generate" — live progress bar indicates stroke rendering.
10. User reviews rendered pages in Result Screen carousel and clicks "Download PDF".
```

### Journey 2: Offline / Spotty Connection Draft Recovery
```
1. User works on a 3,000-word assignment in the library on poor Wi-Fi.
2. Every keystroke and formatting change is saved immediately to browser IndexedDB (0ms latency).
3. The Wi-Fi drops completely; user closes the browser or the laptop runs out of battery.
4. User re-opens the laptop and navigates back to HandText.
5. The Editor detects the unsynced local draft in IndexedDB with a newer timestamp than the cloud.
6. HandText restores the complete draft with a toast: "Restored your local draft".
7. Once online, user hits Ctrl+S; draft synchronizes safely to Supabase.
```

---

## 4. Brand Identity & Visual Language

- **Brand Name**: HandText (formerly HandText Answer).
- **Core Aesthetic**: Clean, modern, academic, high-contrast workstation.
  - Dark mode and light mode native support with CSS variable tokens.
  - Deep slate backgrounds (`#090d16` in dark mode) paired with warm stationery paper previews (`#ffffff`, `#fdfcf7`, `#fbf3e2`).
  - Tactile physical UI cues: notebook ruling lines, ruled margins, ink swatches, and paper grain textures.
- **Typography**:
  - UI Interface: Clean modern sans-serif (`Inter`, system UI font).
  - Handwritten Canvas Engines: Authenticated cursive/handwritten Google Fonts (`Patrick Hand`, `Kalam`, `Caveat`, `Indie Flower`, `Shadows Into Light`, `Gloria Hallelujah`).

---

## 5. System Requirements & Platform Support

- **Browser Compatibility**:
  - Chrome / Chromium 90+ (Full hardware-accelerated 2D Canvas support).
  - Firefox 90+.
  - Safari 15+ (macOS and iPadOS).
  - Edge 90+.
- **Hardware Acceleration**:
  - Utilizes standard HTML5 Canvas 2D rendering pipeline (low GPU/CPU overhead, runs smoothly on low-spec student laptops and Chromebooks).
- **Storage Requirements**:
  - Client-side IndexedDB storage: typically < 5 MB per project.
  - Cloud database: lightweight text & JSON settings rows in PostgreSQL.
