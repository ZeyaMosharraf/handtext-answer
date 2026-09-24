# HandText — Legal & Consent Implementation

## 1. Scope & Disclaimer
This document outlines the operational implementation of legal, privacy, and consent systems in HandText (`https://handtext-answer.vercel.app/`).

> **Notice**: These documents accurately reflect the technical data architecture of HandText. They are product-level disclosures and operational safeguards, and do not replace legal review by qualified Indian legal counsel.

---

## 2. Privacy Policy (`/privacy`)
The Privacy Policy at `src/routes/privacy.tsx` accurately details:

1. **Authentication & User Data**:
   - Managed via Supabase GoTrue (email/password, OAuth).
   - Only essential account data (email, user ID) is collected.
2. **Local Storage & IndexedDB Autosave**:
   - Draft documents, text inputs, and formulas are saved locally in the browser's IndexedDB storage for offline persistence and zero-loss editing.
   - Local drafts are not sent to any analytics platform.
3. **Cloud Document Storage**:
   - Saved projects are stored in PostgreSQL on Supabase, protected by strict Postgres Row-Level Security (RLS) linked to `auth.uid()`.
   - Users cannot see, query, or edit any other user's projects.
4. **Analytics & Google Consent Mode v2**:
   - Google Analytics 4 is strictly disabled by default.
   - No tracking cookies or measurement beacons are sent until the user grants explicit consent.
   - Raw document content, formulas, assignment answers, and personal names are excluded from analytics event parameters via an allowlist (`ALLOWED_PARAM_KEYS`).
5. **Data Retention & Account Deletion**:
   - Users may delete projects directly from their dashboard.
   - Users can request complete account and data removal via `support@handtext.app`.
6. **Applicable Legal Framework**:
   - Outlines compliance principles under the **Information Technology Act, 2000**, the **IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011**, and the **Digital Personal Data Protection Act, 2023 (DPDP Act)** of India.

---

## 3. Terms of Service (`/terms`)
The Terms of Service at `src/routes/terms.tsx` defines:
1. **Service Purpose**: HandText provides online formatting tools to transform typed text into handwritten visual formats.
2. **User Content & Intellectual Property**:
   - Users retain full copyright and ownership of all text, documents, notes, and academic content typed into HandText.
   - HandText does not claim ownership or use user-generated document content to train public models.
3. **Academic Integrity & Acceptable Use**:
   - Prohibits fraudulent use, academic dishonesty, forgery, identity theft, or impersonation of authorized signatures.
   - Users are solely responsible for ensuring compliance with institutional honor codes.
4. **Service Availability & Disclaimers**:
   - Service provided on an "as-is" and "as-available" basis.
   - Disclaims liability for lost drafts, server outages, or institutional rejection of generated documents.
5. **Governing Law & Jurisdiction**:
   - Governed by the laws of India, with courts having competent jurisdiction.

---

## 4. Consent Banner & Preference Center (`src/components/ConsentBanner.tsx`)
- **Banner Placement**: Fixed unobtrusive bottom banner on first visit.
- **Granular Choice**: Users can "Accept All", "Reject Non-Essential", or "Customize Preferences".
- **Default State**: Analytics consent is strictly `denied`.
- **Persistent Management**: Users can reopen and change their preferences at any time by clicking "Cookie Preferences" in the public footer.
- **No Blocking of Core Features**: Rejecting analytics does not impair document editing, handwriting generation, or PDF exporting.
