/**
 * Automated test suite for Long-Document Pagination, PDF Export, and ZIP Export
 *
 * Verifies:
 * 1. 1-page PDF document creation
 * 2. Multi-page PDF document creation (5 pages, 10 pages)
 * 3. 39+ page long-document layout & pagination
 * 4. Page ordering and sequential numbering (1 .. 39)
 * 5. No page truncation (all 39 pages present)
 * 6. Content variety preservation: Text, Math, Table, Graph in long document
 * 7. 39-page complete PDF export via createPdfDocument
 * 8. ZIP export via createZipBlob with zero-padded file names (page-001.png .. page-039.png)
 * 9. Error resilience on empty input
 */

import { layoutDocument } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS, type HandwritingSettings } from "../src/lib/handwriting/types";
import { createPdfDocument, createZipBlob, slugify } from "../src/lib/export";
import type { GeneratedPage } from "../src/lib/handwriting";
import JSZip from "jszip";

function createMockCanvas(): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * 9 }),
    font: "",
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    arc: () => {},
    fillText: () => {},
    bezierCurveTo: () => {},
    setLineDash: () => {},
  } as unknown as CanvasRenderingContext2D;
}

const ctx = createMockCanvas();
const settings: HandwritingSettings = {
  ...DEFAULT_SETTINGS,
  fontSize: 24,
  lineSpacing: 1.4,
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName} - ${detail ?? "assertion failed"}`);
    failed++;
  }
}

// 1x1 100% transparent PNG data URL for mock page rendering
const DUMMY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function runTests() {
  console.log("\n=== Long-Document & Export Subsystem Tests ===\n");

  // ─── 1. Single Page PDF Document Creation ───────────────────────────────────
  {
    const pages: GeneratedPage[] = [
      { pageNumber: 1, dataUrl: DUMMY_PNG, width: 794, height: 1123 },
    ];
    const pdf = await createPdfDocument(pages);
    assert(pdf.getNumberOfPages() === 1, "Single page PDF produces exactly 1 page in jsPDF");
  }

  // ─── 2. Multi-Page PDF Document Creation (5 & 10 pages) ────────────────────
  {
    const pages5: GeneratedPage[] = Array.from({ length: 5 }, (_, i) => ({
      pageNumber: i + 1,
      dataUrl: DUMMY_PNG,
      width: 794,
      height: 1123,
    }));
    let progressCalls = 0;
    const pdf5 = await createPdfDocument(pages5, (curr, tot) => {
      progressCalls++;
      assert(curr <= tot, `Progress call ${curr} <= ${tot}`);
    });
    assert(pdf5.getNumberOfPages() === 5, "5-page PDF produces exactly 5 pages");
    assert(progressCalls === 5, "Progress callback called for all 5 pages");

    const pages10: GeneratedPage[] = Array.from({ length: 10 }, (_, i) => ({
      pageNumber: i + 1,
      dataUrl: DUMMY_PNG,
      width: 794,
      height: 1123,
    }));
    const pdf10 = await createPdfDocument(pages10);
    assert(pdf10.getNumberOfPages() === 10, "10-page PDF produces exactly 10 pages");
  }

  // ─── 3. Long Document Layout & Pagination (39+ pages) ──────────────────────
  {
    const sampleGraphDef = {
      id: "test-g1",
      type: "function" as const,
      title: "Response Curve",
      space: {
        xMin: -5,
        xMax: 5,
        yMin: -5,
        yMax: 5,
        showGrid: true,
        showAxisLabels: true,
        originVisible: true,
      },
      functions: [{ expression: "x^2", label: "y=x^2" }],
    };
    const graphJson = JSON.stringify(sampleGraphDef).replace(/"/g, "&quot;");

    // Generate an assignment with 220 detailed sections to produce 40+ pages
    const sections: string[] = [];
    for (let i = 1; i <= 220; i++) {
      sections.push(`<h2>Section ${i}: Problem Analysis and Boundary Conditions</h2>`);
      sections.push(
        `<p>In this analysis of question ${i}, we examine the continuous linear transformation across state space. ` +
        `We demonstrate convergence properties by iteratively integrating the boundary conditions across multiple coordinate frames.</p>`
      );
      sections.push(
        `<p>Evaluating the second-order partial differentials yields asymptotic stability across all spectral components. ` +
        `Furthermore, empirical evaluations confirm that the numerical tolerances remain well below five parts per thousand.</p>`
      );
      if (i % 8 === 0) {
        sections.push(
          `<div class="math-block" data-latex="C = \\begin{bmatrix} 4.9821 & 5.875 \\\\ 5.875 & 8.125 \\end{bmatrix}" data-color="#b3231f"></div>`
        );
      }
      if (i % 12 === 0) {
        sections.push(
          `<table><thead><tr><th>Variable</th><th>Initial Value</th><th>Refined Estimate</th></tr></thead>` +
          `<tbody><tr><td>X1</td><td>1.024</td><td>1.089</td></tr><tr><td>X2</td><td>2.450</td><td>2.512</td></tr></tbody></table>`
        );
      }
      if (i % 20 === 0) {
        sections.push(
          `<div class="graph-block" data-graph-definition="${graphJson}" contenteditable="false"><span>[Graph]</span></div>`
        );
      }
      sections.push(
        `<p>Concluding analysis for step ${i}: The residual error satisfies all tolerance bounds without divergence.</p>`
      );
    }

    const fullHtml = sections.join("\n");
    const docLayout = layoutDocument(ctx, {
      content: fullHtml,
      settings,
      question: "Comprehensive Engineering Assignment — Final Submission",
    });

    console.log(`Generated page count for long document: ${docLayout.pages.length}`);
    assert(docLayout.pages.length >= 39, `Long document generates at least 39 pages (actual: ${docLayout.pages.length})`);

    // ─── 4. Page Ordering & Sequential Numbering ──────────────────────────────
    let sequential = true;
    for (let idx = 0; idx < docLayout.pages.length; idx++) {
      if (docLayout.pages[idx]!.pageNumber !== idx + 1) {
        sequential = false;
        break;
      }
    }
    assert(sequential, "All generated pages follow strict 1-indexed sequential numbering (1, 2, ... N)");

    // ─── 5. No Page Truncation ───────────────────────────────────────────────
    const firstPage = docLayout.pages[0]!;
    const midPage = docLayout.pages[Math.floor(docLayout.pages.length / 2)]!;
    const lastPage = docLayout.pages[docLayout.pages.length - 1]!;

    assert(firstPage.placements.length > 0, "First page contains placements");
    assert(midPage.placements.length > 0, "Middle page contains placements");
    assert(lastPage.placements.length > 0, "Last page contains placements");

    // ─── 6. Content Variety Preservation (Math, Table, Graph) ─────────────────
    let hasMathPlacement = false;
    let hasTablePlacement = false;
    let hasGraphPlacement = false;

    for (const page of docLayout.pages) {
      for (const p of page.placements) {
        if (p.type === "mathBlock") hasMathPlacement = true;
        if (p.type === "tableRow") hasTablePlacement = true;
        if (p.type === "graphBlock") hasGraphPlacement = true;
      }
    }

    assert(hasMathPlacement, "Math blocks correctly preserved in long document layout");
    assert(hasTablePlacement, "Table rows correctly preserved in long document layout");
    assert(hasGraphPlacement, "Graph blocks correctly preserved in long document layout");

    // ─── 7. 39+ Page Complete PDF Document Export ─────────────────────────────
    const longPages: GeneratedPage[] = docLayout.pages.map((p) => ({
      pageNumber: p.pageNumber,
      dataUrl: DUMMY_PNG,
      width: p.coordinates.pageWidth,
      height: p.coordinates.pageHeight,
    }));

    let pdfProgressReported = 0;
    const longPdf = await createPdfDocument(longPages, (current, total) => {
      pdfProgressReported = current;
    });

    assert(
      longPdf.getNumberOfPages() === docLayout.pages.length,
      `Complete PDF contains all ${docLayout.pages.length} pages (matches document layout exactly)`
    );
    assert(
      pdfProgressReported === docLayout.pages.length,
      `PDF progress callback completed to 100% (${pdfProgressReported}/${docLayout.pages.length})`
    );

    // Verify binary integrity of exported PDF
    const pdfBuffer = Buffer.from(longPdf.output("arraybuffer"));
    assert(pdfBuffer.length > 10000, `Exported PDF size is valid (${Math.round(pdfBuffer.length / 1024)} KB)`);
    assert(pdfBuffer.toString("ascii", 0, 5) === "%PDF-", "Exported PDF has valid %PDF- header");
    assert(pdfBuffer.includes(Buffer.from("%%EOF")), "Exported PDF terminates with standard %%EOF");

    // ─── 8. ZIP Export with Zero-Padded File Naming ───────────────────────────
    const zipBlob = await createZipBlob(longPages, "assignment");
    assert(zipBlob.size > 0, "Generated ZIP blob is non-empty");

    const zip = await JSZip.loadAsync(zipBlob);
    const filenames = Object.keys(zip.files);
    assert(filenames.length === docLayout.pages.length, `ZIP archive contains all ${docLayout.pages.length} page files`);

    // Verify zero-padding format (e.g., assignment-page-001.png .. assignment-page-039.png)
    assert(filenames.includes("assignment-page-001.png"), "ZIP includes zero-padded first page 'assignment-page-001.png'");
    assert(filenames.includes("assignment-page-039.png"), "ZIP includes zero-padded 39th page 'assignment-page-039.png'");

    // Verify alphabetical sort preserves chronological page order
    const sorted = [...filenames].sort();
    let orderMatches = true;
    for (let i = 0; i < filenames.length; i++) {
      const expectedPadded = String(i + 1).padStart(3, "0");
      if (sorted[i] !== `assignment-page-${expectedPadded}.png`) {
        orderMatches = false;
        break;
      }
    }
    assert(orderMatches, "ZIP zero-padded filenames guarantee strict alphabetical sorting matching page order");
  }

  // ─── 9. Slugify Utility ───────────────────────────────────────────────────
  {
    assert(slugify("My Physics Assignment 2026!") === "my-physics-assignment-2026", "slugify cleans punctuation");
    assert(slugify("") === "handtext", "slugify fallback on empty name");
  }

  // ─── 10. Error Handling on Empty Pages ─────────────────────────────────────
  {
    let pdfThrew = false;
    try {
      await createPdfDocument([]);
    } catch {
      pdfThrew = true;
    }
    assert(pdfThrew, "createPdfDocument safely throws on empty page array");

    let zipThrew = false;
    try {
      await createZipBlob([], "empty");
    } catch {
      zipThrew = true;
    }
    assert(zipThrew, "createZipBlob safely throws on empty page array");
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
