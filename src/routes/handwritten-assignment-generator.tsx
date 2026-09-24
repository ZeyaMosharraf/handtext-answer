/**
 * src/routes/handwritten-assignment-generator.tsx
 *
 * Dedicated landing page for "Handwritten Assignment Generator" intent.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, GraduationCap, CheckCircle2, BookOpen, Layers } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HandwrittenSample } from "@/components/HandwrittenSample";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta } from "@/lib/siteConfig";

const SAMPLE_TEXT = `# Assignment 2: Database Management Systems

Q.1 Explain the difference between clustered and non-clustered indexing.

Ans:
A clustered index determines the physical order of data in a table. Because rows are sorted physically, a table can possess only one clustered index.

A non-clustered index stores a separate pointer structure that references data pages, allowing multiple non-clustered indexes per table.`;

export const Route = createFileRoute("/handwritten-assignment-generator")({
  head: () =>
    buildRouteMeta({
      title: "Handwritten Assignment Generator — Turn Typed Assignments into Handwriting | HandText",
      description:
        "Generate handwritten assignments online with HandText. Dedicated answer margins, Q&A numbering, realistic student handwriting styles, and multi-page A4 PDF exports.",
      path: "/handwritten-assignment-generator",
    }),
  component: HandwrittenAssignmentPage,
});

function HandwrittenAssignmentPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                <GraduationCap className="size-3 mr-1" /> Student Productivity
              </Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Handwritten Assignment Generator
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Convert your typed homework, college assignments, and lab reports into realistic
                handwritten A4 pages. Designed specifically for academic formats with question
                numbering, answer margins, and clean multi-page flow.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Generate Assignment Free <ArrowRight className="size-4 ml-1" />
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
                  Typed Homework Input
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {SAMPLE_TEXT}
                </pre>
              </Card>
              <HandwrittenSample
                text={SAMPLE_TEXT}
                styleId="exam"
                alt="Generated handwritten assignment page"
              />
            </div>
          </div>
        </section>

        {/* Assignment Features */}
        <section className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Engineered specifically for academic assignments
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              <Card className="p-6">
                <CheckCircle2 className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Dedicated Answer Margin</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Format question markers (Q.1, Q.2) and answer tags (Ans:) into a dedicated left
                  margin line, mirroring traditional exam and assignment answer sheets.
                </p>
              </Card>
              <Card className="p-6">
                <BookOpen className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Natural Student Penmanship</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select styles like "College Notes" or "Exam Style" that look like authentic student
                  handwriting rather than an artificial decorative calligraphy font.
                </p>
              </Card>
              <Card className="p-6">
                <Layers className="size-6 text-primary" />
                <h3 className="mt-3 text-lg font-bold">Multi-Page A4 Flow</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Long 5-10 page homework assignments flow automatically across A4 sheets with
                  consistent line counts and page numbers ready for submission.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Generate your assignment now</h2>
            <p className="max-w-xl text-muted-foreground">
              Paste your typed answers, choose your handwriting, and download a ready-to-print PDF.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Create Assignment Free <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
