/**
 * src/routes/faq.tsx
 *
 * Frequently Asked Questions with FAQPage Schema.org structured data.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta, SITE_URL } from "@/lib/siteConfig";

const FAQS = [
  {
    q: "What is HandText?",
    a: "HandText is an online AI Handwriting Generator that converts typed text into realistic handwritten pages. It supports standard text, student assignments, multi-page study notes, mathematical LaTeX equations, tables, and customizable paper layouts.",
  },
  {
    q: "What is an AI handwriting generator?",
    a: "An AI handwriting generator is software that transforms digital, keyboard-typed text into natural handwriting aesthetics. Unlike a repetitive computer font, an advanced handwriting generator introduces subtle variations in letter sizing, baseline jitter, pen stroke thickness, and ink flow to simulate real human writing.",
  },
  {
    q: "How does HandText convert text to handwriting?",
    a: "You paste or type your content into the editor, select a handwriting style (such as Natural, Neat, College Notes, Fast Writer, or Exam Style), choose your paper type (A4, Ruled, Grid, Exam sheet), and customize ink color and margins. HandText lays out your text line by line with natural variations and renders printable multi-page documents instantly.",
  },
  {
    q: "Can I create handwritten assignments online?",
    a: "Yes. HandText is specifically engineered for multi-page assignments. It includes an integrated Answer Margin system (e.g., Q.1, Ans markers), structured headings, and continuous pagination across standard A4 sheets ready to export as PDF or PNG.",
  },
  {
    q: "Can HandText handle mathematical equations and formulas?",
    a: "Yes. HandText features a dedicated MathBlock engine that natively renders LaTeX formulas, fractions, square roots, integrals, summations, and matrices directly onto handwritten lines alongside regular text.",
  },
  {
    q: "Can HandText format tables in handwriting?",
    a: "Yes. You can insert structured data tables with customized rows, columns, headers, and alignments. HandText renders table cells with natural handwritten text and clean grid borders.",
  },
  {
    q: "Can I create multiple handwritten pages?",
    a: "Yes. Long documents automatically paginate across multiple A4 or Letter sheets without cutting off paragraphs or formulas. You can preview all pages in real-time and export them as a single multi-page PDF or a ZIP of PNG images.",
  },
  {
    q: "How does saving work in HandText?",
    a: "HandText uses a hybrid storage architecture: active edits are continuously autosaved to your browser's local IndexedDB storage, and when signed in, documents synchronize to secure cloud storage under your private account.",
  },
  {
    q: "Does HandText work on both desktop and mobile?",
    a: "Yes. HandText is a fully responsive web application that runs in any modern browser on Windows, macOS, Linux, iOS, and Android without requiring software installation.",
  },
  {
    q: "Is HandText free to use?",
    a: "Yes. During our public launch validation period, HandText is completely free to use. All handwriting styles, paper layouts, LaTeX math typesetting, table formatting, and high-resolution PDF/PNG exports are available to all users without any paid subscription.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

export const Route = createFileRoute("/faq")({
  head: () =>
    buildRouteMeta({
      title: "FAQ — HandText AI Handwriting Generator",
      description:
        "Answers to frequently asked questions about HandText: text-to-handwriting conversion, math formulas, assignments, paper formats, and exports.",
      path: "/faq",
      structuredData: faqStructuredData,
    }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-primary">
            <HelpCircle className="size-4" /> Frequently Asked Questions
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Everything you need to know about HandText
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Clear, honest answers on how our AI handwriting generator works, supported formats, math
            typesetting, and export options.
          </p>
        </div>

        <div className="mt-12 space-y-5">
          {FAQS.map((faq, idx) => (
            <Card key={idx} className="p-6 transition-shadow hover:shadow-md">
              <h2 className="text-xl font-bold text-foreground">{faq.q}</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">{faq.a}</p>
            </Card>
          ))}
        </div>

        <section className="mt-16 text-center">
          <Card className="flex flex-col items-center gap-4 p-8 sm:p-10">
            <h2 className="text-2xl font-bold">Ready to generate your first handwritten page?</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Paste your text and see realistic handwriting in seconds. Free to start with no credit
              card required.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Start Generating Free <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
