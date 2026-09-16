/**
 * table-dom.ts — DOM utility layer for mutating HTMLTableElements inside contenteditable.
 *
 * Responsibilities:
 * - Detecting table selection context (active cell, row, column, alignment)
 * - Safe row insertion (above/below) and deletion
 * - Safe column insertion (left/right) and deletion
 * - Column alignment attribute & style synchronization
 * - Keyboard navigation (Tab / Shift+Tab)
 */

export type ColumnAlignment = "left" | "center" | "right";

export interface TableSelectionInfo {
  table: HTMLTableElement;
  row: HTMLTableRowElement;
  cell: HTMLTableCellElement;
  rowIndex: number;
  colIndex: number;
  totalRows: number;
  totalCols: number;
  isHeader: boolean;
  alignment: ColumnAlignment;
}

/**
 * Inspects current window selection to determine if cursor is inside a table cell.
 */
export function getTableSelectionInfo(editorEl: HTMLElement | null): TableSelectionInfo | null {
  if (typeof window === "undefined" || !editorEl) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  let node: Node | null = sel.anchorNode;
  if (!node || !editorEl.contains(node)) return null;

  const cell = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest(
    "td, th",
  ) as HTMLTableCellElement | null;
  if (!cell || !editorEl.contains(cell)) return null;

  const row = cell.closest("tr") as HTMLTableRowElement | null;
  const table = cell.closest("table") as HTMLTableElement | null;
  if (!row || !table || !editorEl.contains(table)) return null;

  const rowIndex = row.rowIndex;
  const colIndex = cell.cellIndex;
  const totalRows = table.rows.length;
  const totalCols = row.cells.length;
  const isHeader = cell.tagName.toLowerCase() === "th" || row.parentElement?.tagName.toLowerCase() === "thead";

  // Determine current alignment from data-align, style, or class
  let alignment: ColumnAlignment = "left";
  const dataAlign = cell.getAttribute("data-align") as ColumnAlignment | null;
  const styleAlign = cell.style.textAlign as ColumnAlignment;
  if (dataAlign === "center" || dataAlign === "right" || dataAlign === "left") {
    alignment = dataAlign;
  } else if (styleAlign === "center" || styleAlign === "right" || styleAlign === "left") {
    alignment = styleAlign;
  } else if (cell.classList.contains("text-center")) {
    alignment = "center";
  } else if (cell.classList.contains("text-right")) {
    alignment = "right";
  }

  return {
    table,
    row,
    cell,
    rowIndex,
    colIndex,
    totalRows,
    totalCols,
    isHeader,
    alignment,
  };
}

/**
 * Focuses a table cell and places cursor at the beginning or end.
 */
export function focusCell(cell: HTMLTableCellElement, atEnd = false): void {
  const range = document.createRange();
  const sel = window.getSelection();
  if (!sel) return;

  if (cell.childNodes.length === 0) {
    cell.appendChild(document.createTextNode(""));
  }

  const targetNode = cell.lastChild || cell;
  if (atEnd && targetNode.nodeType === Node.TEXT_NODE) {
    range.setStart(targetNode, (targetNode as Text).length);
    range.setEnd(targetNode, (targetNode as Text).length);
  } else {
    range.selectNodeContents(cell);
    range.collapse(!atEnd);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Inserts a new table row above or below the target index.
 */
export function insertTableRow(
  table: HTMLTableElement,
  targetRowIndex: number,
  relative: "above" | "below",
): HTMLTableRowElement | null {
  if (!table || table.rows.length === 0) return null;

  const clampedRowIndex = Math.max(0, Math.min(table.rows.length - 1, targetRowIndex));
  const referenceRow = table.rows[clampedRowIndex];
  if (!referenceRow) return null;

  const insertIndex = relative === "above" ? clampedRowIndex : clampedRowIndex + 1;
  const colCount = Math.max(1, referenceRow.cells.length);

  // Inherit column alignments from reference row or header
  const alignments: ColumnAlignment[] = [];
  for (let c = 0; c < colCount; c++) {
    const refCell = referenceRow.cells[c] || table.rows[0]?.cells[c];
    const align = (refCell?.getAttribute("data-align") as ColumnAlignment) || (refCell?.style.textAlign as ColumnAlignment) || "left";
    alignments.push(align === "center" || align === "right" ? align : "left");
  }

  // Determine container (tbody or table)
  let parentContainer: HTMLElement = table;
  const tbody = table.querySelector("tbody");
  if (tbody) {
    parentContainer = tbody;
  }

  const newRow = document.createElement("tr");
  newRow.className = "cursor-text";

  for (let c = 0; c < colCount; c++) {
    const td = document.createElement("td");
    const align = alignments[c] ?? "left";
    td.className = `border border-border p-2 cursor-text whitespace-pre-wrap text-${align}`;
    td.style.textAlign = align;
    td.setAttribute("data-align", align);
    td.textContent = "Cell";
    newRow.appendChild(td);
  }

  if (insertIndex >= table.rows.length) {
    parentContainer.appendChild(newRow);
  } else {
    const nextRow = table.rows[insertIndex];
    if (nextRow && nextRow.parentNode) {
      nextRow.parentNode.insertBefore(newRow, nextRow);
    } else {
      parentContainer.appendChild(newRow);
    }
  }

  return newRow;
}

/**
 * Deletes a row by index. If only 1 row remains, removes the entire table.
 */
export function deleteTableRow(table: HTMLTableElement, rowIndex: number): boolean {
  if (!table || table.rows.length === 0) return false;
  if (table.rows.length <= 1) {
    table.remove();
    return true;
  }

  const clampedIndex = Math.max(0, Math.min(table.rows.length - 1, rowIndex));
  table.deleteRow(clampedIndex);
  return true;
}

/**
 * Inserts a column to the left or right of the target column index.
 */
export function insertTableColumn(
  table: HTMLTableElement,
  targetColIndex: number,
  relative: "left" | "right",
): boolean {
  if (!table || table.rows.length === 0) return false;

  const insertOffset = relative === "left" ? 0 : 1;

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    if (!row) continue;
    const isHeader = r === 0 && (row.parentElement?.tagName.toLowerCase() === "thead" || row.cells[0]?.tagName.toLowerCase() === "th");
    const colIndex = Math.max(0, Math.min(row.cells.length, targetColIndex + insertOffset));

    const cell = document.createElement(isHeader ? "th" : "td") as HTMLTableCellElement;
    if (isHeader) {
      cell.className = "border border-border p-2 bg-muted/40 font-semibold cursor-text whitespace-pre-wrap text-left";
      cell.textContent = `Column ${row.cells.length + 1}`;
    } else {
      cell.className = "border border-border p-2 cursor-text whitespace-pre-wrap text-left";
      cell.textContent = "Cell";
    }
    cell.style.textAlign = "left";
    cell.setAttribute("data-align", "left");

    if (colIndex >= row.cells.length) {
      row.appendChild(cell);
    } else {
      const targetCell = row.cells[colIndex];
      row.insertBefore(cell, targetCell ?? null);
    }
  }

  return true;
}

/**
 * Deletes a column by index across all rows. If only 1 column remains, removes the entire table.
 */
export function deleteTableColumn(table: HTMLTableElement, colIndex: number): boolean {
  if (!table || table.rows.length === 0) return false;
  const firstRow = table.rows[0];
  if (!firstRow || firstRow.cells.length <= 1) {
    table.remove();
    return true;
  }

  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    if (row && row.cells[colIndex]) {
      row.deleteCell(colIndex);
    }
  }

  return true;
}

/**
 * Sets text alignment for an entire column in a table.
 */
export function setTableColumnAlignment(
  table: HTMLTableElement,
  colIndex: number,
  alignment: ColumnAlignment,
): void {
  if (!table) return;

  for (let r = 0; r < table.rows.length; r++) {
    const cell = table.rows[r]?.cells[colIndex];
    if (!cell) continue;

    cell.style.textAlign = alignment;
    cell.setAttribute("data-align", alignment);
    cell.classList.remove("text-left", "text-center", "text-right");
    cell.classList.add(`text-${alignment}`);
  }
}

/**
 * Handles Tab and Shift+Tab navigation between table cells.
 * Returns true if navigation was handled.
 */
export function handleTableTabNavigation(editorEl: HTMLElement, shiftKey: boolean): boolean {
  const info = getTableSelectionInfo(editorEl);
  if (!info) return false;

  const { table, rowIndex, colIndex } = info;
  const currentRow = table.rows[rowIndex];
  if (!currentRow) return false;

  if (shiftKey) {
    // Navigate backwards
    if (colIndex > 0) {
      const prevCell = currentRow.cells[colIndex - 1];
      if (prevCell) {
        focusCell(prevCell, true);
        return true;
      }
    } else if (rowIndex > 0) {
      const prevRow = table.rows[rowIndex - 1];
      const lastCell = prevRow?.cells[prevRow.cells.length - 1];
      if (lastCell) {
        focusCell(lastCell, true);
        return true;
      }
    }
    return false;
  }

  // Navigate forwards
  if (colIndex < currentRow.cells.length - 1) {
    const nextCell = currentRow.cells[colIndex + 1];
    if (nextCell) {
      focusCell(nextCell);
      return true;
    }
  } else if (rowIndex < table.rows.length - 1) {
    const nextRow = table.rows[rowIndex + 1];
    const firstCell = nextRow?.cells[0];
    if (firstCell) {
      focusCell(firstCell);
      return true;
    }
  } else {
    // Last cell of last row: automatically append a new row!
    const newRow = insertTableRow(table, rowIndex, "below");
    const firstCell = newRow?.cells[0];
    if (firstCell) {
      focusCell(firstCell);
      return true;
    }
  }

  return false;
}
