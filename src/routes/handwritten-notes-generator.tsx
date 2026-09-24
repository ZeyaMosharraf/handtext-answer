/**
 * src/routes/handwritten-notes-generator.tsx
 *
 * Dedicated landing page for "Handwritten Notes Generator" intent.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookMarked, Highlighter, FileText, Check } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HandwrittenSample } from "@/components/HandwrittenSample";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta } from "@/lib/siteConfig";

const SAMPLE_TEXT = `# Cell Biology — Mitosis Stages

1. Prophase:
Chromatin condenses into visible chromosomes. The nuclear envelope disintegrates.

2. Metaphase:
Chromosomes align across the equatorial metaphase plate.

3. Anaphase:
Sister chromatids separate toward opposite centrosome poles.`;

export const Route = createFileRoute("/handwritten-notes-generator")({
  head: () =>
    buildRouteMeta({
      title: "Handwritten Notes Generator — AI Study Notes Maker | HandText",
      description:
        "Convert typed study guides, lecture summaries, and book notes into realistic handwritten notebook pages with custom ruled paper, ink colors, and PDF exports.",
      path: "/handwritten-notes-generator",
    }),
  component: HandwrittenNotesPage,
});

function HandwrittenNotesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <BookMarked className="size-3 mr-1" /> Study & Revision
              </Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Handwritten Notes Generator
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Turn your typed study guides, book summaries, and lecture notes into authentic
                handwritten notebooks. Improve study retention with aesthetically pleasing notes on
                ruled, grid, or plain paper.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Generate Study Notes Free <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>
                <Link to="/handwriting-generator">
                  <Button size="lg" variant="outline">
                    Browse Paper Types
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Typed Notes Input
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {SAMPLE_TEXT}
                </pre>
              </Card>
              <HandwrittenSample
                text={SAMPLE_TEXT}
                styleId="neat"
                alt="Generated handwritten study notes"
              />
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Designed for organized, aesthetic note-taking
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <Card className="p-6">
                <Highlighter className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Bullet Points & Headings</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Bold headers and numbered lists are naturally emphasized with authentic pen
                  weight variations without breaking visual harmony.
                </p>
              </Card>
              <Card className="p-6">
                <FileText className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Ruled & Grid Notebooks</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Format your notes on standard single-ruled notebook lines, French Seyès grid, or
                  clean engineering grid paper.
                </p>
              </Card>
              <Card className="p-6">
                <Check className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Printable Study Guides</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Export multi-page PDF documents optimized for binding, digital tablet review, or
                  physical printing on home printers.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Transform your typed notes today</h2>
            <p className="max-w-xl text-muted-foreground">
              Create beautiful handwritten revision notes from your summaries in seconds.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Create Notes Now <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
