import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  Cpu,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Layers,
  PenLine,
  Settings2,
  Sparkles,
  Type,
} from "lucide-react";

import { HandwrittenSample } from "@/components/HandwrittenSample";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { buildRouteMeta, SITE_URL } from "@/lib/siteConfig";

const homepageStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HandText",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    description: "Online AI Handwriting Generator converting typed text into realistic handwritten pages.",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HandText",
    url: SITE_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HandText AI Handwriting Generator",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web Browser",
    description:
      "HandText is an online AI handwriting generator that converts typed text into realistic handwritten pages, notes, assignments, math equations, and A4 documents.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  },
];

export const Route = createFileRoute("/")({
  head: () =>
    buildRouteMeta({
      title: "HandText — AI Handwriting Generator | Text to Handwriting",
      description:
        "HandText is an online AI handwriting generator that converts typed text into realistic handwritten pages. Create assignments, notes, math formulas, and multi-page A4 documents.",
      path: "/",
      structuredData: homepageStructuredData,
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
  { icon: FileText, title: "Multi-page documents", body: "Long documents flow across pages without breaking headings." },
  { icon: Download, title: "PDF, PNG and ZIP", body: "Export exactly what you see in the preview." },
  { icon: FolderOpen, title: "Saved projects", body: "Everything autosaves so you never lose your work." },
  { icon: Sparkles, title: "AI handwriting engine", body: "Micro-variations ensure no two characters look identical." },
  { icon: Settings2, title: "Fine control", body: "Ink colour, pen thickness, spacing, slant and imperfection levels." },
];

const STEPS = [
  { n: "01", title: "Write or paste text", body: "Type or paste your text, with headings, bullets and numbered points." },
  { n: "02", title: "Choose your handwriting", body: "Pick an authentic handwriting style and preview it instantly." },
  { n: "03", title: "Customise the page", body: "Paper format, margins, ink tone and line spacing." },
  { n: "04", title: "Generate", body: "Pages are laid out and written for you in real-time." },
  { n: "05", title: "Download", body: "Export as high-resolution PDF, PNG or a ZIP of all pages." },
];

const USE_CASES = [
  "Handwritten assignments",
  "Study and revision notes",
  "Math equations & LaTeX",
  "Exam preparation",
  "Personal letters & journals",
];

const CORE_TOOLS = [
  {
    title: "Handwriting Generator Online",
    path: "/handwriting-generator",
    description: "The core web tool to convert typed text to natural handwriting with custom lines and ink.",
    icon: PenLine,
  },
  {
    title: "Text to Handwriting",
    path: "/text-to-handwriting",
    description: "Fast converter from Word, Google Docs, or Notion into printable handwritten pages.",
    icon: Type,
  },
  {
    title: "Handwritten Assignments",
    path: "/handwritten-assignment-generator",
    description: "Dedicated answer margins, question markers (Q.1, Ans:), and multi-page A4 exports.",
    icon: GraduationCap,
  },
  {
    title: "Handwritten Study Notes",
    path: "/handwritten-notes-generator",
    description: "Format lecture summaries into aesthetic revision notebooks on ruled or grid paper.",
    icon: BookOpen,
  },
  {
    title: "Handwritten Math & Formulas",
    path: "/handwritten-math-generator",
    description: "Native LaTeX math typesetting: integrals, fractions, summations, and matrices.",
    icon: Calculator,
  },
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
              <Badge>AI Handwriting Generator</Badge>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                Turn Typed Text Into Realistic Handwriting
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Create handwritten assignments, notes, mathematical content, tables, and multi-page
                A4 documents from typed text.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg">
                    Generate Handwriting Free <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline">
                    See how it works
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Free to start · No credit card needed · Export as print-ready PDF or PNG
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Typed Text
                </p>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {HERO_ANSWER}
                </pre>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-primary">
                  HandText <ArrowRight className="size-3" />
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

        {/* Specialized Tools & Intent Grid */}
        <section className="border-t border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="max-w-2xl">
              <Badge className="bg-primary/10 text-primary border-primary/20">Product Suite</Badge>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
                Specialized Tools for Every Handwriting Need
              </h2>
              <p className="mt-2 text-muted-foreground">
                Whether you need academic assignment formatting, study notes, or complex math
                equations, HandText provides dedicated workflows:
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CORE_TOOLS.map((tool) => (
                <Link key={tool.path} to={tool.path as any} className="group block">
                  <Card className="h-full p-6 transition-all hover:border-primary hover:shadow-md">
                    <tool.icon className="size-6 text-primary" />
                    <h3 className="mt-3 text-lg font-bold group-hover:text-primary">{tool.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                      Explore Tool <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-y border-border py-16">
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
              <span key={u} className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium">
                <Check className="size-4 text-primary" /> {u}
              </span>
            ))}
          </div>
        </section>

        {/* Examples */}
        <section id="examples" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Example gallery</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            All pages below are generated examples produced by HandText.
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

        {/* FAQ Teaser */}
        <section className="border-t border-border bg-surface py-16">
          <div className="mx-auto max-w-4xl px-4">
            <Card className="p-8 text-center sm:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                <HelpCircle className="size-4" /> Support & Questions
              </div>
              <h3 className="mt-4 text-2xl font-bold">Frequently Asked Questions</h3>
              <p className="mt-2 text-muted-foreground max-w-xl mx-auto text-sm">
                Have questions about handwriting styles, paper line spacing, mobile compatibility,
                LaTeX math formulas, or supported export formats?
              </p>
              <div className="mt-6 flex justify-center">
                <Link to="/faq">
                  <Button variant="outline">
                    Read the FAQ <ArrowRight className="size-4 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Turn your typed text into handwriting now</h2>
            <p className="max-w-xl text-muted-foreground">
              Paste your text and get printable handwritten pages in under a minute.
            </p>
            <Link to="/auth">
              <Button size="lg">
                Create Handwritten Document <ArrowRight className="size-4 ml-1" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
