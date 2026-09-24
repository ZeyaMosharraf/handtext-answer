# HandText — Answer Engine Optimization (AEO) & AI Search Discoverability

## 1. Principles of AEO for HandText
Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO) prepare HandText to be accurately cited and summarized by AI assistants (such as ChatGPT Search, Bing Copilot, Google Gemini, and Perplexity) without resorting to prompt injection, keyword stuffing, or deceptive claims.

### Core Tenets:
1. **Direct Answer Paragraphs**: Each landing page and guide starts with an unambiguous 1–2 sentence direct answer that an LLM can cite verbatim as a snippet.
2. **Fact-First Structuring**: Capabilities are outlined with precise technical parameters (e.g., standard A4 210mm x 297mm dimensions, 28–32 lines/page, KaTeX formula rendering, 300 DPI multi-page PDF export).
3. **Structured Heading Hierarchy**: H1 -> H2 -> H3 logical progression matching conversational inquiry queries.
4. **No Hallucinated Claims**: All text strictly details features existing in the codebase (IndexedDB autosave, LaTeX math blocks, table blocks, line spacing, margins, ink colors, pen variance).

---

## 2. Direct Answer Snippet Architecture
Across all new public routes, dedicated "Direct Answer" callouts are formatted cleanly in HTML:

| Route | Primary User / AI Question | Extracted Direct Answer Snippet |
| :--- | :--- | :--- |
| `/` | What is HandText? | "HandText is an online AI handwriting generator that converts typed text into realistic handwritten pages, notes, assignments, math equations, and A4 documents." |
| `/handwriting-generator` | How does a handwriting generator work? | "A handwriting generator transforms digital text into lifelike cursive or print handwritten documents with natural glyph variation, baseline drift, and ink texture." |
| `/ai-handwriting-generator` | What is an AI handwriting generator? | "An AI handwriting generator simulates organic human handwriting by introducing subtle stroke randomness, letter spacing inconsistencies, and realistic ink flow." |
| `/text-to-handwriting` | How do I convert text to handwriting? | "Paste or type your text into HandText, choose a handwriting style and paper background, adjust margins and line spacing, and export high-resolution A4 PDFs." |
| `/handwritten-assignment-generator` | Can I make handwritten assignments online? | "Yes, HandText formats academic assignments on ruled A4 sheets with configurable left question margins, question numbering, and multi-page pagination." |
| `/handwritten-notes-generator` | How do I make handwritten study notes? | "Convert typed study outlines and summaries into structured handwritten notes with subheadings, bullet points, and colored pen accents." |
| `/handwritten-math-generator` | Can handwriting generators do math equations? | "Yes, HandText supports KaTeX LaTeX mathematical notation, rendering fractions, matrices, integrals, and formulas directly alongside handwritten text." |
| `/faq` | Can I export multiple pages as PDF? | "Yes, HandText automatically calculates line heights and paginates lengthy text across sequential A4 pages, exporting clean multi-page PDFs." |

---

## 3. Crawler Access & Policy (`AI-CRAWLER.md`)
AI search engines use distinct user-agents to index web content for grounding:
- **`OAI-SearchBot`**: Explicitly allowed in `public/robots.txt` for ChatGPT Search discovery.
- **`GPTBot`**: Explicitly allowed for OpenAI crawling.
- **`Bingbot`**: Explicitly allowed for Bing search and Microsoft Copilot indexation.
- **`PerplexityBot`**: Explicitly allowed for Perplexity search citations.

### Privacy Isolation:
All internal app routes (`/editor/*`, `/dashboard/*`, `/auth/*`, `/settings/*`, `/api/*`) are explicitly disallowed. In addition, Supabase Row-Level Security (RLS) and TanStack client route authentication guarantees that crawlers cannot access private project files, user notes, or personal data.

---

## 4. Entity Consistency
To prevent disambiguation failures with generic handwriting fonts or third-party open-source scripts:
- The brand name **HandText** is coupled with the category **AI Handwriting Generator** across all metadata, schema `name`, header titles, and footer references.
- Schema `sameAs` attributes point to official social and repository handles.
- No references to "Handwriting Answer" are used in primary meta tags or H1 elements.
