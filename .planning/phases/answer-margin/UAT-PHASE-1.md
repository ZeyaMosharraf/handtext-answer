# Phase M2-P4 — Answer-Sheet Layout / Question Margin System: Phase 1 UAT Report

> *GSD Phase 1 Verification Report — Types & Serialization Contract*  
> *Phase:* M2-P4 — Phase 1  
> *Execution Date:* September 20, 2026  
> *Status:* PASSED (All Automated & Invariant Gates Met)  

---

## 1. Summary of Changes

Phase 1 established the formal data model and backward-compatible serialization contract for the Answer-Sheet Layout / Question Margin System without touching rendering, pagination, or editor UX.

### Modified Files:
1. `src/types/document.ts`:
   - Added `MarginMarkerType` (`"question" | "answer" | "subquestion" | "marks" | "custom"`).
   - Added `MarginMarker` interface with `type`, `text`, and optional `color` ink override.
   - Extended `BaseBlock` with optional `marginMarker?: MarginMarker | undefined`.
   - Updated block factory helpers (`createEmptyTextBlock`, `createMathBlock`, `createTableBlock`, `createGraphBlock`) to optionally accept `marginMarker`.
2. `src/lib/handwriting/types.ts`:
   - Added `AnswerMarginConfig` interface (`enabled: boolean`, `width: number`, `showDivider?: boolean`, `dividerColor?: string`).
   - Extended `PageConfig` with `answerMargin?: AnswerMarginConfig | undefined`.
   - Added default `answerMargin: { enabled: true, width: 72, showDivider: true }` to `DEFAULT_PAGE`.
3. `src/lib/editor/blockSerialization.ts`:
   - Exported `serializeMarginMarkerAttrs(marker?: MarginMarker): string`.
   - Exported `parseMarginMarkerFromAttributes(textAttr, typeAttr, colorAttr): MarginMarker | undefined`.
   - Updated `blocksToHtml` to serialize `data-margin-marker`, `data-margin-type`, and optional `data-margin-color`.
   - Updated `htmlToBlocks` (DOMParser path, fast regex path, and legacy/mixed parser) to restore `marginMarker` cleanly.
4. `tests/test-answer-margin-serialization.ts` [NEW]:
   - Created comprehensive 92-assertion automated test suite for Phase 1.

---

## 2. Invariant & Contract Verification

| Requirement / Invariant | Status | Verification Detail |
| :--- | :---: | :--- |
| **MarginMarker Data Model** | PASSED | `MarginMarker` defined with `type`, `text`, optional `color`. Attached to `BaseBlock`. |
| **AnswerMarginConfig in PageConfig** | PASSED | Defaults to `{ enabled: true, width: 72, showDivider: true }` in `DEFAULT_PAGE`. |
| **Serialization Format** | PASSED | Uses standard `data-margin-marker="..."`, `data-margin-type="..."`, `data-margin-color="..."`. |
| **Round-Trip Idempotency** | PASSED | `blocksToHtml(htmlToBlocks(blocksToHtml(blocks))) === blocksToHtml(blocks)` produces 100% byte-identical output. |
| **Optional Absence / Legacy Docs** | PASSED | Documents and blocks without markers deserialize with `marginMarker: undefined`. Zero degradation. |
| **All Block Types Supported** | PASSED | `TextBlock`, `MathBlock`, `TableBlock`, and `GraphBlock` all support optional margin markers. |
| **Special Characters Escaped** | PASSED | Quotes, ampersands, angle brackets in marker text are escaped/unescaped safely. |
| **No Premature Feature Creep** | PASSED | Gutter UI, canvas renderer, pagination, and design panel were NOT modified. |

---

## 3. Test Suite Execution Results

### 1. Phase 1 Answer Margin Serialization Suite (`tests/test-answer-margin-serialization.ts`):
```
─── 1. PageConfig & AnswerMarginConfig Defaults ───
  ✓ DEFAULT_PAGE has answerMargin defined
  ✓ AnswerMargin enabled by default
  ✓ Default margin width is 72px
  ✓ Divider visible by default

─── 2. MarginMarker Data Model & Creation Helpers ───
  ✓ TextBlock has stable txt_ id
  ✓ TextBlock marginMarker type preserved
  ✓ TextBlock marginMarker text preserved
  ✓ TextBlock marginMarker color is undefined when omitted
  ✓ MathBlock marginMarker type is 'answer'
  ✓ MathBlock marginMarker text is 'Ans'
  ✓ MathBlock marginMarker color override preserved
  ✓ TableBlock marginMarker type is 'subquestion'
  ✓ TableBlock marginMarker text is 'a)'
  ✓ GraphBlock marginMarker type is 'marks'
  ✓ GraphBlock marginMarker text is '[5M]'
  ✓ TextBlock without marker has undefined marginMarker
  ✓ MathBlock without marker has undefined marginMarker

─── 3. Attribute Serialization & Deserialization Helpers ───
  ✓ Undefined marker serializes to empty string
  ✓ Empty text marker serializes to empty string
  ✓ Serialized contains data-margin-marker='Q1'
  ✓ Serialized contains data-margin-type='question'
  ✓ No data-margin-color when omitted
  ✓ Serialized contains data-margin-marker='Ans'
  ✓ Serialized contains data-margin-type='answer'
  ✓ Serialized contains data-margin-color='#1d3fb5'
  ✓ Special characters escaped in attributes
  ✓ Special characters unescaped cleanly
  ✓ Type preserved as custom
  ✓ Invalid type falls back to 'custom'
  ✓ Custom color parsed

─── 4. Full DocumentBlock Serialization & HTML Attributes ───
  ✓ HTML has txtWithMarker ID
  ✓ HTML has data-margin-marker='Q1'
  ✓ HTML has data-margin-type='question'
  ✓ HTML has mathWithMarker ID
  ✓ HTML has data-margin-marker='Ans'
  ✓ HTML has data-margin-type='answer'
  ✓ HTML has data-margin-color='#1d3fb5'
  ✓ HTML has tableWithMarker ID
  ✓ HTML has data-margin-marker='a)'
  ✓ HTML has data-margin-type='subquestion'
  ✓ HTML has graphWithMarker ID
  ✓ HTML has data-margin-marker='[5M]'
  ✓ HTML has data-margin-type='marks'

─── 5. Deserialization & Round-Trip Idempotency ───
  ✓ Restored count matches original count (5 blocks)
  ✓ Block 0 ID matches
  ✓ Block 0 type is text
  ✓ Block 0 marginMarker text restored as 'Q1'
  ✓ Block 0 marginMarker type restored as 'question'
  ✓ Block 0 marginMarker color is undefined
  ✓ Block 1 ID matches
  ✓ Block 1 type is math
  ✓ Block 1 marginMarker text restored as 'Ans'
  ✓ Block 1 marginMarker type restored as 'answer'
  ✓ Block 1 marginMarker color restored
  ✓ Block 1 MathBlock color attribute intact
  ✓ Block 2 ID matches
  ✓ Block 2 type is text
  ✓ Block 2 has NO marginMarker (undefined)
  ✓ Block 3 ID matches
  ✓ Block 3 type is table
  ✓ Block 3 marginMarker text restored as 'a)'
  ✓ Block 3 marginMarker type restored as 'subquestion'
  ✓ Block 4 ID matches
  ✓ Block 4 type is graph
  ✓ Block 4 marginMarker text restored as '[5M]'
  ✓ Block 4 marginMarker type restored as 'marks'
  ✓ Second serialization cycle produces 100% byte-identical HTML
  ✓ Second restored count matches
  ✓ Second restored marker text matches

─── 6. Legacy Documents & Backward Compatibility ───
  ✓ Legacy document parsed 4 blocks
  ✓ Legacy block 0 (text) has marginMarker === undefined
  ✓ Legacy block 1 (math) has marginMarker === undefined
  ✓ Legacy block 2 (table) has marginMarker === undefined
  ✓ Legacy block 3 (graph) has marginMarker === undefined
  ✓ Unadorned legacy produced 3 blocks
  ✓ Unadorned block text has marginMarker === undefined
  ✓ Unadorned block math has marginMarker === undefined
  ✓ Unadorned block table has marginMarker === undefined
  ✓ Embedded <p data-margin-marker='Q3'> parsed correctly
  ✓ Embedded type parsed correctly
  ✓ Embedded math data-margin-marker parsed correctly

─── 7. All MarginMarker Types & Custom Values ───
  ✓ type 'question' roundtrips
  ✓ text 'Q10' roundtrips
  ✓ type 'answer' roundtrips
  ✓ text 'Ans.' roundtrips
  ✓ type 'subquestion' roundtrips
  ✓ text '(ii)' roundtrips
  ✓ type 'marks' roundtrips
  ✓ text '[15M]' roundtrips
  ✓ type 'custom' roundtrips
  ✓ text 'OR' roundtrips
  ✓ custom color '#c0392b' roundtrips

Results: 92 passed, 0 failed.
```

### 2. Regression Suites Executed:
- `tests/test-block-serialization.ts`: **78 passed, 0 failed**
- `tests/test-phase2-editor-blocks.ts`: **60 passed, 0 failed**
- `tests/test-mathblock-color.ts`: **44 passed, 0 failed**
- `tests/test-mathblock-copy-paste.ts`: **45 passed, 0 failed**
- `tests/test-math-matrix.ts`: **62 passed, 0 failed**

**Total Assertions Across Test Suites:** **381 passed, 0 failed.**

### 3. Build & Type Safety:
- `npx tsc --noEmit`: Exited 0 (zero TypeScript errors).
- `npm run build`: Exited 0 (production client & Nitro server build succeeded).

---

## 4. Conclusion & Next Steps

Phase 1 is 100% complete and validated.
Per instructions, execution stops here. Phase 2 (Handwriting Parser & Layout Geometry) is ready for invocation when requested.
