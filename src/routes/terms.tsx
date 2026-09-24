/**
 * src/routes/terms.tsx
 *
 * HandText Terms of Service
 */

import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { buildRouteMeta } from "@/lib/siteConfig";

export const Route = createFileRoute("/terms")({
  head: () =>
    buildRouteMeta({
      title: "Terms of Service — HandText",
      description:
        "Terms and conditions for using HandText AI Handwriting Generator service.",
      path: "/terms",
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            <strong>Last Updated:</strong> September 2026
          </p>

          <p className="lead text-lg text-muted-foreground">
            Welcome to <strong>HandText</strong>. By accessing or using our website and services at{" "}
            <code>https://handtext-answer.vercel.app/</code>, you agree to be bound by these Terms of
            Service ("Terms"). If you do not agree to these Terms, please do not use our service.
          </p>

          <hr className="my-8 border-border" />

          <h2 className="text-2xl font-bold text-foreground">1. Description of Service</h2>
          <p className="text-muted-foreground">
            HandText is an online <strong>AI Handwriting Generator</strong> software application that
            converts user-provided typed text, assignments, study notes, mathematical formulas, and
            structured tables into realistically formatted handwritten pages suitable for viewing,
            printing, and exporting in PDF, PNG, or ZIP formats.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">2. User Accounts & Responsibilities</h2>
          <p className="text-muted-foreground">
            To save documents and access advanced handwriting styles, you may register an account.
            You are responsible for safeguarding your login credentials and for all activities that
            occur under your account. You agree to provide accurate and complete registration information.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">3. Acceptable Use Policy</h2>
          <p className="text-muted-foreground">
            You agree to use HandText only for lawful purposes. You agree NOT to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              Submit content that is defamatory, obscene, infringing on intellectual property rights,
              or otherwise unlawful.
            </li>
            <li>
              Use the service to impersonate another individual's genuine physical signature or
              commit fraud, forgery, or deceptive misrepresentation.
            </li>
            <li>
              Attempt to disrupt, reverse-engineer, decompile, or overload our servers, APIs, or database systems.
            </li>
            <li>
              Submit documents in violation of your educational institution's academic integrity policies.
              HandText provides formatting and handwriting generation tools for study notes, personal
              projects, and authorized submissions; users remain solely responsible for how they utilize
              generated outputs.
            </li>
          </ul>

          <h2 className="mt-10 text-2xl font-bold text-foreground">4. User Content & Intellectual Property</h2>
          <p className="text-muted-foreground">
            <strong>Ownership:</strong> You retain full intellectual property ownership of all typed
            text, notes, and content you submit to HandText, as well as the resulting generated
            handwritten output pages.
          </p>
          <p className="text-muted-foreground">
            <strong>Service License:</strong> By uploading content, you grant HandText a limited,
            non-exclusive license solely to process, render, and store your document to deliver the service
            to you.
          </p>
          <p className="text-muted-foreground">
            <strong>HandText IP:</strong> The HandText brand, software algorithms, layout engine,
            mathematical typesetting algorithms, interface designs, and digital handwriting font assets
            are the exclusive intellectual property of HandText.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">5. Service Availability & Disclaimers</h2>
          <p className="text-muted-foreground">
            HandText is provided on an "AS IS" and "AS AVAILABLE" basis. While we strive for maximum
            reliability, we do not warrant that the service will be uninterrupted, error-free, or that
            generated handwriting will be indistinguishable from a specific individual's handwriting.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">6. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by applicable law, HandText shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages resulting from your use of
            or inability to use the service.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">7. Governing Law & Jurisdiction</h2>
          <p className="text-muted-foreground">
            These Terms shall be governed by and construed in accordance with the laws of India. Any
            disputes arising out of or relating to these Terms or the service shall be subject to the
            exclusive jurisdiction of the courts located in New Delhi, India.
          </p>

          <h2 className="mt-10 text-2xl font-bold text-foreground">8. Contact Information</h2>
          <p className="text-muted-foreground">
            For any questions, legal inquiries, or notices regarding these Terms, please contact us at:
          </p>
          <p className="font-semibold text-foreground">
            Email: <code>legal@handtext.internal</code>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
