/**
 * src/routes/handwritten-math-generator.tsx
 *
 * Dedicated landing page for "Handwritten Math Generator" intent.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Binary, Calculator, CheckCheck, Sigma } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HandwrittenSample } from "@/components/HandwrittenSample";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta } from "@/lib/siteConfig";

const SAMPLE_TEXT = `# Calculus II: Definite Integrals

Evaluate the integral:

$$\\int_0^1 x^2 \\cdot e^{x} \\, dx$$

Using integration by parts:
Let $u = x^2$ and $dv = e^x dx$.
Then $du = 2x dx$ and $v = e^x$.

$$= [x^2 e^x]_0^1 - 2 \\int_0^1 x e^x \\, dx = e - 2$$`;

export const Route = createFileRoute("/handwritten-math-generator")({
  head: () =>
    buildRouteMeta({
      title: "Handwritten Math Generator — LaTeX Formulas to Handwriting | HandText",
      description:
        "Generate handwritten mathematical equations online. Convert LaTeX formulas, integrals, fractions, matrices, and physics calculations into natural handwriting.",
      path: "/handwritten-math-generator",
    }),
  component: HandwrittenMathPage,
});

function HandwrittenMathPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <Calculator className="size-3 mr-1" /> STEM & Engineering
              </Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Handwritten Math Generator
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Render mathematical equations, calculus derivations, physics formulas, and matrices
                directly in handwriting. Powered by a native LaTeX math layout engine that aligns
                formulas seamlessly with handwritten text lines.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Generate Handwritten Math <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>
                <Link to="/handwriting-generator">
                  <Button size="lg" variant="outline">
                    Try Handwriting Tool
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  LaTeX Math Syntax
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {SAMPLE_TEXT}
                </pre>
              </Card>
              <HandwrittenSample
                text={SAMPLE_TEXT}
                styleId="natural"
                alt="Generated handwritten math and equations"
              />
            </div>
          </div>
        </section>

        {/* Math Capabilities */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Full mathematical notation support
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Most handwriting converters fail on formulas, producing ugly image cutouts or breaking
              line heights. HandText calculates exact bounding boxes and baseline baselines:
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <Card className="p-6">
                <Sigma className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Calculus & Summations</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Support for definite integrals, limits, summation symbols, derivatives, and
                  fractions aligned with ruled lines.
                </p>
              </Card>
              <Card className="p-6">
                <Binary className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Matrices & Greek Letters</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Multi-dimensional matrices, vectors, determinants, and standard Greek notation
                  (&alpha;, &beta;, &theta;, &pi;, &sigma;).
                </p>
              </Card>
              <Card className="p-6">
                <CheckCheck className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Inline & Display Math</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Embed inline variables ($x + y = z$) within regular paragraphs or centered display
                  equations on dedicated lines.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Generate handwritten math formulas now</h2>
            <p className="max-w-xl text-muted-foreground">
              Type or paste your LaTeX math expressions and export ready-to-submit mathematical documents.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Start with Math Free <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
