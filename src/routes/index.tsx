import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Download,
  FileText,
  FolderOpen,
  Layers,
  PenLine,
  Settings2,
  Sparkles,
  Type,
} from "lucide-react";

import { HandwrittenSample } from "@/components/HandwrittenSample";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Badge, Button, Card } from "@/components/ui/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HandText AI — Turn typed answers into handwritten pages" },
      {
        name: "description",
        content:
          "Paste your answer, pick a handwriting style, customise the page and export realistic handwritten answer sheets as PDF or PNG.",
      },
      { property: "og:title", content: "HandText AI — Realistic handwritten answer sheets" },
      {
        property: "og:description",
        content: "Convert typed assignments and notes into realistic handwritten pages, ready to print or export.",
      },
    ],
  }),
  component: Landing,
});

const HERO_ANSWER = `# Database Normalization

Normalization organises data in a database to reduce redundancy and improve integrity.

1. Removes duplicate data
Each fact is stored only once, so updates stay consistent.

2. Improves data integrity
Well defined relations prevent update and deletion anomalies.

3. Simplifies maintenance
Smaller, focused tables are easier to extend later.`;

const FEATURES = [
  { icon: PenLine, title: "Realistic handwriting", body: "Every letter varies in size, slant and baseline, like a real pen." },
  { icon: Type, title: "Multiple styles", body: "Natural, neat, fast writer, college notes and exam style." },
  { icon: Layers, title: "Custom page layouts", body: "A4, A5, Letter, ruled, grid or exam sheets with your own margins." },
  { icon: FileText, title: "Multi-page answers", body: "Long answers flow across pages without breaking headings." },
  { icon: Download, title: "PDF, PNG and ZIP", body: "Export exactly what you see in the preview." },
  { icon: FolderOpen, title: "Saved projects", body: "Everything autosaves so you never lose an answer." },
  { icon: Sparkles, title: "AI answer assistance", body: "Improve, expand or restructure your answer — only if you accept it." },
  { icon: Settings2, title: "Fine control", body: "Ink colour, pen thickness, spacing, slant and imperfection levels." },
];

const STEPS = [
  { n: "01", title: "Write your answer", body: "Type or paste it, with headings, bullets and numbered points." },
  { n: "02", title: "Choose your handwriting", body: "Pick a style and preview it instantly." },
  { n: "03", title: "Customise the page", body: "Paper, margins, ink and spacing." },
  { n: "04", title: "Generate", body: "Pages are laid out and written for you." },
  { n: "05", title: "Download", body: "Export as PDF, PNG or a ZIP of all pages." },
];

const USE_CASES = [
  "University assignments",
  "Exam preparation",
  "Study notes",
  "Personal notes",
  "Revision material",
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge>Built for students</Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Turn your answers into realistic handwritten pages
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Write or paste your answer, choose your handwriting style, and generate realistic
                handwritten pages ready to review, print or export.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Create handwritten answer <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline">
                    See how it works
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Free to start · No card needed · Export as PDF or PNG
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Typed answer
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {HERO_ANSWER}
                </pre>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary">
                  HandText AI <ArrowRight className="size-3" />
                </div>
              </Card>
              <HandwrittenSample
                text={HERO_ANSWER}
                styleId="natural"
                alt="Example of a generated handwritten page"
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s) => (
                <Card key={s.n} className="p-5">
                  <span className="text-hand text-2xl text-primary">{s.n}</span>
                  <h3 className="mt-2 font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Everything you need</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-5">
                <f.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Use cases */}
        <section className="border-y border-border bg-surface py-14">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4">
            <h2 className="mr-4 text-2xl font-extrabold tracking-tight">Made for</h2>
            {USE_CASES.map((u) => (
              <span key={u} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
                <Check className="size-4 text-primary" /> {u}
              </span>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section id="examples" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Example gallery</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All pages below are generated examples produced by HandText AI.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { styleId: "exam", label: "Exam Style", text: "The OSI model is a conceptual framework that describes how data moves through a network in seven layers.\n\n1. Physical\nTransmits raw bits over the medium.\n\n2. Data Link\nHandles framing and error detection." },
              { styleId: "college", label: "College Notes", text: "# Photosynthesis\n\nPlants convert light energy into chemical energy stored as glucose.\n\n- Takes place in the chloroplast\n- Requires water and carbon dioxide\n- Releases oxygen as a by-product" },
              { styleId: "neat", label: "Neat Student", text: "# Cloud Computing\n\nCloud computing delivers computing resources over the internet on demand.\n\n1. Scalability\nResources scale with demand.\n\n2. Cost efficiency\nNo upfront hardware cost." },
            ].map((ex) => (
              <div key={ex.styleId} className="space-y-2">
                <HandwrittenSample
                  text={ex.text}
                  styleId={ex.styleId}
                  alt={`Generated example page in ${ex.label} handwriting`}
                />
                <p className="text-sm text-muted-foreground">{ex.label} · generated example</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Your next assignment, handwritten</h2>
            <p className="max-w-xl text-muted-foreground">
              Paste your answer and get printable handwritten pages in under a minute.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Create handwritten answer <ArrowRight className="size-4" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
