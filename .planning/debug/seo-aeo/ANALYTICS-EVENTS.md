# Google Analytics 4 Event Taxonomy — HandText

**Objective:** Define a privacy-centric, product-level analytics event taxonomy.  
**Critical Rule:** User document text, homework assignments, mathematical formulas, table values, or personal identifiable inputs MUST NEVER be passed as parameters to Google Analytics.

---

## 1. Consent Model & Data Safeguards
- **Consent Prerequisite:** Google Consent Mode v2 (`analytics_storage: 'denied'` by default).
- **Execution Rule:** No GA scripts execute and no analytics cookies are created until the user explicitly accepts optional analytics via the consent banner.
- **Revocability:** Users can adjust or revoke analytics preferences at any time via the "Cookie Preferences" link in the footer.
- **IP Masking:** Enabled by default in Google Analytics 4.

---

## 2. Event Specification Table

| Event Name | Trigger Location | Parameters Passed | Privacy / Content Verification | Consent Required |
| :--- | :--- | :--- | :--- | :---: |
| `page_view` | Global route navigation | `page_path`, `page_title` | No document content; standard URL path only | Yes |
| `sign_up` | Auth modal / page | `method` (`"email"` or `"oauth"`) | No passwords, emails, or PII passed | Yes |
| `login` | Auth modal / page | `method` (`"email"` or `"oauth"`) | No passwords, emails, or PII passed | Yes |
| `project_created` | Dashboard new project action | `style_id`, `paper_id` | Metadata IDs only; 0 document text | Yes |
| `project_opened` | Dashboard click on project | `project_id` (hashed or UUID only) | UUID only; no title/content | Yes |
| `document_saved` | Editor manual/cloud save | `page_count_bucket` (`"1"`, `"2-3"`, `"4+"`) | Page counts only; 0 document content | Yes |
| `document_exported` | Editor export menu | `export_format` (`"pdf"`, `"png"`, `"zip"`), `page_count` | File format and page count only | Yes |
| `handwriting_generated` | Editor rendering complete | `style_id`, `ink_color`, `page_count` | Styling tokens only | Yes |
| `math_block_added` | Editor toolbar Insert Math | `mode` (`"inline"` or `"block"`) | No formula text or LaTeX string passed | Yes |
| `table_block_added` | Editor toolbar Insert Table | `rows`, `cols` | Numeric grid dimensions only; 0 cell text | Yes |
| `write_on_page_used` | Canvas direct editing mode | `tool` (`"text"`) | Action type only; 0 text passed | Yes |

---

## 3. Parameter Restrictions
- **FORBIDDEN:** `document_text`, `latex`, `formula`, `table_data`, `question_text`, `answer_text`, `email`, `user_name`.
- **ALLOWED:** Enumerated styles (`"natural"`, `"exam"`), formats (`"pdf"`, `"png"`), counts (`1`, `2`, `3`), and standard navigation paths.
