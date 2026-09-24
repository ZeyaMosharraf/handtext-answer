/**
 * src/routes/handwriting-generator.tsx
 *
 * Core Landing Page: Handwriting Generator Online
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, PenLine, Sliders, FileDown, Layers } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HandwrittenSample } from "@/components/HandwrittenSample";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta } from "@/lib/siteConfig";

const SAMPLE_TEXT = `# Lecture 4: Operating System Kernels

An operating system kernel is the core program that manages system resources and hardware communications.

Key Functions:
1. Memory Management: Allocates RAM across executing processes.
2. CPU Scheduling: Determines process execution priority.
3. Device I/O: Interfaces with physical peripherals safely.`;

export const Route = createFileRoute("/handwriting-generator")({
  head: () =>
    buildRouteMeta({
      title: "Handwriting Generator Online — HandText",
      description:
        "Free online handwriting generator. Turn typed text into realistic handwritten pages with custom styles, ruled paper, and PDF export.",
      path: "/handwriting-generator",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "HandText Handwriting Generator",
        applicationCategory: "DesignApplication",
        operatingSystem: "Web Browser",
        description: "Generate realistic handwritten pages from typed text online.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    }),
  component: HandwritingGeneratorPage,
});

function HandwritingGeneratorPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge>Online Tool</Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Online Handwriting Generator
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Convert your typed documents, articles, and assignments into authentic handwritten
                sheets directly in your web browser. Customize ink color, paper lines, and slant
                with instant live preview.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Generate Handwriting Free <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>
                <Link to="/text-to-handwriting">
                  <Button size="lg" variant="outline">
                    Text to Handwriting
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                No software download required · Works on Mac, PC, Tablet, and Mobile
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Typed Text Input
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {SAMPLE_TEXT}
                </pre>
              </Card>
              <HandwrittenSample
                text={SAMPLE_TEXT}
                styleId="natural"
                alt="Generated handwriting example on ruled page"
              />
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Why use an online handwriting generator?
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              HandText eliminates the mechanical look of computer fonts by calculating realistic
              imperfections, baseline variations, and ink absorption on the fly.
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-5">
                <PenLine className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">Diverse Handwritings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose between neat student writing, fast cursive notes, and exam styles.
                </p>
              </Card>
              <Card className="p-5">
                <Sliders className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">Full Aesthetic Control</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adjust ink tone (blue, black, red, gel pen), letter spacing, and line margins.
                </p>
              </Card>
              <Card className="p-5">
                <Layers className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">Standard Paper Types</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Format on standard A4, ruled notebook lines, graph grids, or blank sheets.
                </p>
              </Card>
              <Card className="p-5">
                <FileDown className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">High-Res Export</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Download crisp 300 DPI multi-page PDF documents or individual PNG pages.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Explore Related Capabilities */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold">Explore Specialized Capabilities</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Link to="/text-to-handwriting" className="group">
              <Card className="p-5 transition hover:border-primary">
                <h3 className="font-semibold group-hover:text-primary">Text to Handwriting</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quickly convert digital text, documents, and notes into realistic handwritten sheets.
                </p>
              </Card>
            </Link>
            <Link to="/handwritten-assignment-generator" className="group">
              <Card className="p-5 transition hover:border-primary">
                <h3 className="font-semibold group-hover:text-primary">Assignment Generator</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Format multi-page homework assignments with answer margins and continuous flow.
                </p>
              </Card>
            </Link>
            <Link to="/handwritten-math-generator" className="group">
              <Card className="p-5 transition hover:border-primary">
                <h3 className="font-semibold group-hover:text-primary">Handwritten Math</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Render complex LaTeX math formulas, fractions, and matrices in handwriting.
                </p>
              </Card>
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Convert your text to handwriting now</h2>
            <p className="max-w-xl text-muted-foreground">
              Paste your text and generate realistic handwritten pages ready for print or export.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Start Generating <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
