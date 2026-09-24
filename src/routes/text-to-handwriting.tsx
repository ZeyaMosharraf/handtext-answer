/**
 * src/routes/text-to-handwriting.tsx
 *
 * Dedicated landing page for "Text to Handwriting" converter intent.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Type, FileCheck, Printer, Download } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HandwrittenSample } from "@/components/HandwrittenSample";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta } from "@/lib/siteConfig";

const SAMPLE_TEXT = `# Environmental Science Summary

Ecosystem resilience refers to the capacity of an ecological community to withstand disturbances and recover its structural integrity.

Key Factors:
1. Biodiversity buffers against catastrophic species collapse.
2. Nutrient cycling retains soil fertility during drought.
3. Habitat connectivity permits genetic migration.`;

export const Route = createFileRoute("/text-to-handwriting")({
  head: () =>
    buildRouteMeta({
      title: "Text to Handwriting Converter Online — HandText",
      description:
        "Convert text to handwriting instantly with HandText. Paste any typed notes or assignments and download high-resolution handwritten PDF or PNG pages.",
      path: "/text-to-handwriting",
    }),
  component: TextToHandwritingPage,
});

function TextToHandwritingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge>Direct Converter</Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Text to Handwriting Converter
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Paste typed text from Microsoft Word, Google Docs, or Notion and convert it into
                realistic handwritten notes and assignments in under 60 seconds.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Convert Text to Handwriting <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>
                <Link to="/faq">
                  <Button size="lg" variant="outline">
                    Read FAQ
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Typed Text
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {SAMPLE_TEXT}
                </pre>
              </Card>
              <HandwrittenSample
                text={SAMPLE_TEXT}
                styleId="fast"
                alt="Converted text to handwriting output"
              />
            </div>
          </div>
        </section>

        {/* 3 Step Conversion Flow */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-center">
              How to convert text to handwriting in 3 steps
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Card className="p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Type className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">1. Paste Your Text</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Copy your typed text, notes, or homework answers and paste them into the HandText editor.
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileCheck className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">2. Select Your Style</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pick your favorite handwriting style, select your ruled or A4 paper, and adjust ink tone.
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Download className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">3. Export & Print</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Export your multi-page handwritten document as a print-ready PDF or high-resolution PNG image.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Ready to convert your text?</h2>
            <p className="max-w-xl text-muted-foreground">
              Get authentic handwritten pages ready for submission, study notes, or journaling.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Convert Now Free <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
