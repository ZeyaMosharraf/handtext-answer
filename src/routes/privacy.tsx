/**
 * src/routes/privacy.tsx
 *
 * HandText Privacy Policy
 */

import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { buildRouteMeta } from "@/lib/siteConfig";

export const Route = createFileRoute("/privacy")({
  head: () =>
    buildRouteMeta({
      title: "Privacy Policy — HandText",
      description:
        "Understand how HandText handles your account, local document storage, cloud persistence, and analytics.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            <strong>Last Updated:</strong> September 2026
          </p>

          <p className="lead text-lg text-muted-foreground">
            At <strong>HandText</strong> ("we", "our", or "us"), accessible from{" "}
            <code>https://handtext-answer.vercel.app/</code>, we respect your privacy. This Privacy
            Policy explains how your personal information and document data are processed when you
            use our AI Handwriting Generator service.
          </p>

          <hr className="my-8 border-border" />

          <h2 className="text-2xl font-bold text-foreground">1. Summary of Core Data Principles</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Your Documents are Private:</strong> Your typed texts, assignments, study notes,
              mathematical equations, and generated handwritten pages belong to you.
            </li>
            <li>
              <strong>No Document Content in Analytics:</strong> We never transmit your document
              content, homework answers, or formulas to our analytics providers.
            </li>
            <li>
              <strong>Local-First Autosaving:</strong> Active editing is saved directly to your
              browser's IndexedDB storage and synced to your private account in the cloud.
            </li>
            <li>
              <strong>Strict Row-Level Security:</strong> Cloud documents are secured with PostgreSQL
              Row-Level Security (RLS) so only your authenticated session can access them.
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-bold text-foreground">2. Information We Collect</h2>

          <h3 className="text-xl font-semibold text-foreground">A. Account Information</h3>
          <p className="text-muted-foreground">
            When you register an account, we collect your email address and authentication credentials
            via our authentication provider (Supabase Auth). If you authenticate using Google OAuth,
            we receive your verified email address and name as provided by Google.
          </p>

          <h3 className="text-xl font-semibold text-foreground">B. Document & Project Content</h3>
          <p className="text-muted-foreground">
            To provide the handwriting generation service, we store the documents you create,
            including typed text, handwriting style selections, margin configurations, mathematical
            LaTeX definitions, and table structures. This content is stored locally on your device
            (via browser IndexedDB) and synchronized to encrypted database storage in Supabase for
            multi-device access.
          </p>

          <h3 className="text-xl font-semibold text-foreground" id="analytics">
            C. Usage Analytics (Consent-Governed)
          </h3>
          <p className="text-muted-foreground">
            If you grant consent via our Cookie & Privacy Banner, we collect anonymous usage
            telemetry via Google Analytics 4. This includes high-level operational events such as
            page navigations, document export formats (e.g., PDF or PNG), and style selections.{" "}
            <strong>
              We strictly enforce an allowlist on analytics parameters: no document text, formulas,
              table data, or personal text is ever sent to Google Analytics.
            </strong>
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">3. How We Use Your Information</h2>
          <p className="text-muted-foreground">We use the collected information solely to:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Provide, maintain, and render your handwritten pages, assignments, and notes.</li>
            <li>Authenticate your account and maintain session persistence.</li>
            <li>Enable PDF, PNG, and ZIP exports of your generated work.</li>
            <li>Monitor technical application performance and server stability.</li>
          </ul>

          <h2 className="mt-10 text-2xl font-bold text-foreground">4. Storage, Security & Service Providers</h2>
          <p className="text-muted-foreground">
            We utilize reputable infrastructure providers to operate HandText:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong>Hosting & Edge Delivery:</strong> Vercel Inc. (front-end delivery and edge routing).
            </li>
            <li>
              <strong>Database & Authentication:</strong> Supabase Pte. Ltd. (encrypted PostgreSQL
              database with Row-Level Security and GoTrue authentication).
            </li>
            <li>
              <strong>Optional Analytics:</strong> Google LLC (Google Analytics 4, operating under Google
              Consent Mode v2).
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-bold text-foreground">5. Your Data Rights & Deletion</h2>
          <p className="text-muted-foreground">
            You retain complete control over your data:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              <strong>Project Deletion:</strong> You can delete any project at any time directly from
              your Dashboard. Deletion permanently removes the project and its history from the cloud database.
            </li>
            <li>
              <strong>Local Cache Clearance:</strong> You can clear your browser's local storage and
              IndexedDB cache at any time through your browser settings.
            </li>
            <li>
              <strong>Account Deletion:</strong> You may request full account and data deletion by
              contacting support at <code>privacy@handtext.internal</code>.
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-bold text-foreground">6. Legal Framework & Contact</h2>
          <p className="text-muted-foreground">
            HandText operates in accordance with applicable data protection principles, including the
            Information Technology Act, 2000, and the Digital Personal Data Protection Act, 2023 (India).
          </p>
          <p className="text-muted-foreground">
            If you have questions regarding this Privacy Policy or your data, please contact our
            privacy team at:
          </p>
          <p className="font-semibold text-foreground">
            Email: <code>privacy@handtext.internal</code>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
