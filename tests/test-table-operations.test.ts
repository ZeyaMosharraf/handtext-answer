import {
  insertTableRow,
  deleteTableRow,
  insertTableColumn,
  deleteTableColumn,
  setTableColumnAlignment,
} from "../src/lib/table-dom";

// Minimal DOM Mock for Node testing
interface MockCell {
  tagName: string;
  cellIndex: number;
  textContent: string;
  className: string;
  style: { textAlign: string };
  getAttribute: (attr: string) => string | null;
  setAttribute: (attr: string, val: string) => void;
  classList: {
    contains: (cls: string) => boolean;
    add: (cls: string) => void;
    remove: (cls: string) => void;
  };
}

interface MockRow {
  rowIndex: number;
  parentElement: { tagName: string };
  parentNode: {
    insertBefore: (newNode: any, refNode: any) => void;
  };
  cells: MockCell[];
  appendChild: (cell: any) => void;
  insertBefore: (cell: any, refCell: any) => void;
  deleteCell: (idx: number) => void;
}

interface MockTable {
  rows: MockRow[];
  querySelector: (sel: string) => any;
  insertRow: (idx: number) => MockRow;
  deleteRow: (idx: number) => void;
  remove: () => void;
}

function createMockTable(rowsCount = 2, colsCount = 2): HTMLTableElement {
  const rows: MockRow[] = [];

  const table: MockTable = {
    rows,
    querySelector: (sel: string) => (sel === "tbody" ? { appendChild: (r: MockRow) => rows.push(r) } : null),
    insertRow: (idx: number) => {
      const r = createMockRow(false);
      rows.splice(idx, 0, r);
      return r;
    },
    deleteRow: (idx: number) => {
      rows.splice(idx, 1);
    },
    remove: () => {
      rows.length = 0;
    },
  };

  function createMockCell(isHeader: boolean, text = "Cell"): MockCell {
    const cell: MockCell = {
      tagName: isHeader ? "TH" : "TD",
      cellIndex: 0,
      textContent: text,
      className: "",
      style: { textAlign: "left" },
      getAttribute: (attr: string) => (attr === "data-align" ? "left" : null),
      setAttribute: function (attr: string, val: string) {
        (this as any)[attr] = val;
      },
      classList: {
        contains: () => false,
        add: () => {},
        remove: () => {},
      },
    };
    return cell;
  }

  function createMockRow(isHeader: boolean): MockRow {
    const rowCells: MockCell[] = [];
    const row: MockRow = {
      rowIndex: 0,
      parentElement: { tagName: isHeader ? "THEAD" : "TBODY" },
      parentNode: {
        insertBefore: (newNode: any, refNode: any) => {
          const idx = rows.indexOf(refNode);
          if (idx >= 0) rows.splice(idx, 0, newNode);
          else rows.push(newNode);
        },
      },
      cells: rowCells,
      appendChild: (cell: any) => {
        cell.cellIndex = rowCells.length;
        rowCells.push(cell);
      },
      insertBefore: (cell: any, refCell: any) => {
        const idx = rowCells.indexOf(refCell);
        if (idx >= 0) rowCells.splice(idx, 0, cell);
        else rowCells.push(cell);
        rowCells.forEach((c: MockCell, i: number) => { c.cellIndex = i; });
      },
      deleteCell: (idx: number) => {
        rowCells.splice(idx, 1);
        rowCells.forEach((c: MockCell, i: number) => { c.cellIndex = i; });
      },
    };
    return row;
  }

  // Header row
  const header = createMockRow(true);
  for (let c = 0; c < colsCount; c++) {
    header.appendChild(createMockCell(true, `Col ${c + 1}`));
  }
  rows.push(header);

  // Body rows
  for (let r = 1; r < rowsCount; r++) {
    const row = createMockRow(false);
    for (let c = 0; c < colsCount; c++) {
      row.appendChild(createMockCell(false, `Cell ${r},${c}`));
    }
    rows.push(row);
  }

  rows.forEach((r: MockRow, i: number) => { r.rowIndex = i; });
  return table as unknown as HTMLTableElement;
}

// Global document mock for Node.js
if (typeof (globalThis as any).document === "undefined") {
  (globalThis as any).document = {
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: "",
        textContent: "",
        style: {},
        setAttribute: () => {},
        getAttribute: () => null,
        classList: { add: () => {}, remove: () => {} },
        cells: [] as any[],
        appendChild: function (child: any) {
          if (!this.cells) this.cells = [];
          this.cells.push(child);
        },
      };
      return el;
    },
  };
}

console.log("\n=== Table DOM Operations Tests ===\n");

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

// 1. Insert Row Below
{
  const table = createMockTable(2, 2);
  assert(table.rows.length === 2, "Initial table has 2 rows");
  insertTableRow(table, 1, "below");
  assert(table.rows.length === 3, "Table has 3 rows after insertTableRow below");
}

// 2. Insert Row Above
{
  const table = createMockTable(2, 2);
  insertTableRow(table, 1, "above");
  assert(table.rows.length === 3, "Table has 3 rows after insertTableRow above");
}

// 3. Delete Row
{
  const table = createMockTable(3, 2);
  deleteTableRow(table, 1);
  assert(table.rows.length === 2, "Table has 2 rows after deleting row index 1");
}

// 4. Delete Row Safety (removes table if last row deleted)
{
  const table = createMockTable(1, 2);
  deleteTableRow(table, 0);
  assert(table.rows.length === 0, "Table safely removed when single remaining row is deleted");
}

// 5. Insert Column Right
{
  const table = createMockTable(2, 2);
  insertTableColumn(table, 0, "right");
  assert(table.rows[0]?.cells.length === 3, "Header has 3 columns after insertTableColumn right");
  assert(table.rows[1]?.cells.length === 3, "Body row has 3 columns after insertTableColumn right");
}

// 6. Insert Column Left
{
  const table = createMockTable(2, 2);
  insertTableColumn(table, 0, "left");
  assert(table.rows[0]?.cells.length === 3, "Header has 3 columns after insertTableColumn left");
}

// 7. Delete Column
{
  const table = createMockTable(2, 3);
  deleteTableColumn(table, 1);
  assert(table.rows[0]?.cells.length === 2, "Header has 2 columns after deleteTableColumn");
  assert(table.rows[1]?.cells.length === 2, "Body row has 2 columns after deleteTableColumn");
}

// 8. Delete Column Safety (removes table if last column deleted)
{
  const table = createMockTable(2, 1);
  deleteTableColumn(table, 0);
  assert(table.rows.length === 0, "Table safely removed when single remaining column is deleted");
}

// 9. Column Alignment Update
{
  const table = createMockTable(2, 2);
  let appliedAlignment = "";
  const targetCell = table.rows[0]?.cells[1];
  if (targetCell) {
    targetCell.setAttribute = (_k: string, v: string) => { appliedAlignment = v; };
  }
  setTableColumnAlignment(table, 1, "center");
  assert(appliedAlignment === "center", "Column alignment applied 'center' to target column");
}

console.log(`\nTable Operations Results: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
