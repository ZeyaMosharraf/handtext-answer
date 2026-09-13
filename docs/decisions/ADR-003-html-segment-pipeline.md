# ADR-003: Stack-Based HTML Inline Formatting Pipeline over Markdown

- **Status**: Accepted `[CURRENT]`
- **Date**: September 2026
- **Context**: Early prototypes of HandText relied on raw Markdown markers (e.g., `**bold**`, `__underline__`, `==black==`). This created severe UX friction: users saw confusing raw markdown punctuation inside their text, and the syntax could not represent complex academic formatting such as relative font scaling (85%–140%), custom student ink colors, or translucent highlighter washes without inventing unstandardized, fragile syntax.
- **Decision**: Transition the entire editor and layout pipeline to a **Semantic HTML & Inline Segment Model**:
  1. The editor operates as a true WYSIWYG rich-text `contenteditable` container emitting semantic HTML tags (`<strong>`, `<em>`, `<u>`, `<table>`) and styled `<span>` tags with `data-scale`, `data-color`, and `data-highlight` attributes.
  2. The parser (`src/lib/handwriting/parse.ts`) uses a stack-based tokenizer (`parseInlineHtml`) to decompose nested DOM structures into flat runs of text (`Seg[]`) with normalized styling.
  3. Continuous segments with identical attributes are automatically coalesced.
- **Reason**:
  - Provides a clean, professional WYSIWYG experience with zero raw markup symbols in the text editor.
  - Effortlessly supports rich multi-property runs (e.g., a word that is simultaneously Bold, 120% Scaled, Black Ink, and Highlighted Yellow).
  - Cleanly parses in both browser DOM environments and headless Node.js/test environments.
- **Consequences**:
  - **Positive**: Rich academic formatting flexibility, intuitive user experience, and robust styling normalization.
  - **Negative**: HTML parsing requires careful DOM sanitization to strip malicious script injection or corrupted styling on paste events.
