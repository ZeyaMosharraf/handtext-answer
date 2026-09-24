import { layoutDocument } from "../src/lib/handwriting/layout";
import { DEFAULT_SETTINGS } from "../src/lib/handwriting/types";

// Create a lightweight mock CanvasRenderingContext2D for layout calculations
function createMockCanvas(): CanvasRenderingContext2D {
  return {
    measureText: (text: string) => ({ width: text.length * 8 }),
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
  } as unknown as CanvasRenderingContext2D;
}

const ctx = createMockCanvas();
const settings = { ...DEFAULT_SETTINGS };

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

console.log("\n=== Table Cell Height Regression Tests ===\n");

// 1. One-line cell: "Cell" -> lineUnits = 1
{
  const tableMarkdown = `| Col 1 | Col 2 |
| --- | --- |
| Cell | Value |`;
  const doc = layoutDocument(ctx, { content: tableMarkdown, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  assert(tableRows.length === 2, "Table has 2 rows (header + body)");
  assert(tableRows[0].lineUnits === 1, "Header row lineUnits is 1", `got ${tableRows[0]?.lineUnits}`);
  assert(tableRows[1].lineUnits === 1, "Single-line cell row lineUnits is 1", `got ${tableRows[1]?.lineUnits}`);
}

// 2. Two-line cell: "Line 1\nLine 2" -> lineUnits = 2
{
  const htmlTable = `<table>
  <tr><th>Header</th></tr>
  <tr><td>Line 1<br>Line 2</td></tr>
</table>`;
  const doc = layoutDocument(ctx, { content: htmlTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  assert(tableRows[1].lineUnits === 2, "Two-line cell row lineUnits is 2", `got ${tableRows[1]?.lineUnits}`);
}

// 3. Explicit blank line: "Line 1\n\nLine 3" -> lineUnits = 3
{
  const htmlTable = `<table>
  <tr><th>Header</th></tr>
  <tr><td>Line 1<br><br>Line 3</td></tr>
</table>`;
  const doc = layoutDocument(ctx, { content: htmlTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  assert(tableRows[1].lineUnits === 3, "Explicit blank line row lineUnits is 3", `got ${tableRows[1]?.lineUnits}`);
  const middleLineText = typeof tableRows[1].cells[0][1] === "string" ? tableRows[1].cells[0][1] : tableRows[1].cells[0][1]?.text;
  assert(middleLineText === "", "Middle line is empty string (blank line)", `got "${middleLineText}"`);
}

// 4. Mixed row: Cell A = 1 line, Cell B = 2 lines, Cell C = 1 line -> row lineUnits = 2
{
  const htmlTable = `<table>
  <tr><th>A</th><th>B</th><th>C</th></tr>
  <tr>
    <td>Short A</td>
    <td>Line 1<br>Line 2</td>
    <td>Short C</td>
  </tr>
</table>`;
  const doc = layoutDocument(ctx, { content: htmlTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  assert(tableRows[1].lineUnits === 2, "Mixed row lineUnits equals tallest cell (2)", `got ${tableRows[1]?.lineUnits}`);
}

// 5. Wrapped cell: lineUnits reflects actual wrapped visual lines
{
  const longText = "This is a very long text that must definitely wrap into multiple lines within the constrained column width boundaries of the table";
  const htmlTable = `<table>
  <tr><th>Header</th></tr>
  <tr><td>${longText}</td></tr>
</table>`;
  const doc = layoutDocument(ctx, { content: htmlTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  const wrappedLineCount = tableRows[1].cells[0].length;
  assert(wrappedLineCount > 1, `Long text wrapped into ${wrappedLineCount} lines`);
  assert(tableRows[1].lineUnits === wrappedLineCount, `Row lineUnits (${tableRows[1].lineUnits}) matches wrapped line count (${wrappedLineCount})`);
}

// 6. Existing table pagination still works (multi-page table)
{
  let manyRows = "<table><tr><th>Col 1</th><th>Col 2</th></tr>";
  for (let i = 0; i < 45; i++) {
    manyRows += `<tr><td>Row ${i}</td><td>Value ${i}</td></tr>`;
  }
  manyRows += "</table>";
  const doc = layoutDocument(ctx, { content: manyRows, settings });
  assert(doc.pages.length >= 2, `Table paginates across multiple pages (total pages: ${doc.pages.length})`);
}

// 7. Existing table header repetition still works
{
  const settingsWithHeaderRepeat = {
    ...settings,
    table: { ...settings.table, repeatHeader: true },
  };
  let manyRows = "<table><tr><th>Header 1</th><th>Header 2</th></tr>";
  for (let i = 0; i < 45; i++) {
    manyRows += `<tr><td>Row ${i}</td><td>Value ${i}</td></tr>`;
  }
  manyRows += "</table>";
  const doc = layoutDocument(ctx, { content: manyRows, settings: settingsWithHeaderRepeat });
  const page2TableRows = doc.pages[1]?.placements.filter((p) => p.type === "tableRow") as any[];
  assert(page2TableRows.length > 0, "Page 2 has table rows");
  assert(page2TableRows[0].isHeader === true, "Page 2 repeats the header row at index 0");
}

// 8. Existing rich text formatting in answer remains intact
{
  const mixedContent = `# Heading 1
Some normal paragraph text with **bold** and *italic*.

| Col A | Col B |
| --- | --- |
| Cell 1 | Cell 2 |

- Bullet item 1
- Bullet item 2
`;
  const doc = layoutDocument(ctx, { content: mixedContent, settings });
  const hasHeading = doc.pages[0]?.placements.some((p) => p.type === "line" && p.kind === "heading");
  const hasTable = doc.pages[0]?.placements.some((p) => p.type === "tableRow");
  const hasBullet = doc.pages[0]?.placements.some((p) => p.type === "line" && p.kind === "bullet");
  assert(Boolean(hasHeading), "Document retains Heading block");
  assert(Boolean(hasTable), "Document retains Table block");
  assert(Boolean(hasBullet), "Document retains Bullet block");
}

// 9. Intentional whitespace preservation inside cells (consecutive spaces & leading spaces)
{
  const whitespaceTable = `<table>
  <tr><th>Header</th></tr>
  <tr><td>    Leading 4 spaces and    multiple    consecutive spaces</td></tr>
</table>`;
  const doc = layoutDocument(ctx, { content: whitespaceTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  const cellLine = tableRows[1].cells[0][0];
  assert(cellLine.text.startsWith("    Leading"), "Cell line preserves intentional leading spaces");
  assert(cellLine.text.includes("    multiple    consecutive"), "Cell line preserves intentional consecutive spaces");
}

// 10. Rich text formatting in cells (bold, italic, underline, custom color, scale)
{
  const richTable = `<table>
  <tr><th>Header</th></tr>
  <tr><td><strong>Bold</strong> and <em>Italic</em> and <u>Underline</u> and <span style="color: #b3231f;" data-scale="1.2">Red Scaled</span></td></tr>
</table>`;
  const doc = layoutDocument(ctx, { content: richTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  const segs = tableRows[1].cells[0][0].segs;
  const boldSeg = segs.find((s: any) => s.bold && s.text.includes("Bold"));
  const italicSeg = segs.find((s: any) => s.italic && s.text.includes("Italic"));
  const underlineSeg = segs.find((s: any) => s.underline && s.text.includes("Underline"));
  const coloredSeg = segs.find((s: any) => s.color === "#b3231f");
  const scaledSeg = segs.find((s: any) => s.scale === 1.2);

  assert(Boolean(boldSeg), "Table cell preserves bold segment");
  assert(Boolean(italicSeg), "Table cell preserves italic segment");
  assert(Boolean(underlineSeg), "Table cell preserves underline segment");
  assert(Boolean(coloredSeg), "Table cell preserves custom ink color segment (#b3231f)");
  assert(Boolean(scaledSeg), "Table cell preserves text font scale segment (1.2)");
}

// 11. Column alignment metadata (left, center, right)
{
  const alignedTable = `<table>
  <tr>
    <th data-align="left" style="text-align: left;">Col Left</th>
    <th data-align="center" style="text-align: center;">Col Center</th>
    <th data-align="right" style="text-align: right;">Col Right</th>
  </tr>
  <tr>
    <td data-align="left">Left</td>
    <td data-align="center">Center</td>
    <td data-align="right">Right</td>
  </tr>
</table>`;
  const doc = layoutDocument(ctx, { content: alignedTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  const alignments = tableRows[0].alignments;
  assert(alignments[0] === "left", "Column 0 alignment is 'left'");
  assert(alignments[1] === "center", "Column 1 alignment is 'center'");
  assert(alignments[2] === "right", "Column 2 alignment is 'right'");
}

// 12. Constrained table width (never exceeds A4 content width)
{
  const veryWideContentTable = `<table>
  <tr><th>Col A</th><th>Col B</th><th>Col C</th></tr>
  <tr>
    <td>Very long text in column A that must wrap and not expand table beyond A4 boundary</td>
    <td>Another very long text in column B that must wrap and not expand table beyond A4 boundary</td>
    <td>Yet another very long text in column C that must wrap and not expand table beyond A4 boundary</td>
  </tr>
</table>`;
  const doc = layoutDocument(ctx, { content: veryWideContentTable, settings });
  const tableRows = doc.pages[0]?.placements.filter((p) => p.type === "tableRow") as any[];
  const colWidths = (tableRows[0]?.columnWidths ?? []) as number[];
  const totalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const contentWidth = (doc.pages[0]?.coordinates.contentRight ?? 0) - (doc.pages[0]?.coordinates.contentLeft ?? 0);
  assert(Math.abs(totalTableWidth - contentWidth) < 0.001, "Total table width strictly matches constrained A4 content width");
}

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
