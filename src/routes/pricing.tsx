import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { PLANS } from "@/lib/plans";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HandText AI" },
      {
        name: "description",
        content: "Simple plans for students: a free tier, a Pro plan with unlimited styles and a discounted Student plan.",
      },
      { property: "og:title", content: "Pricing — HandText AI" },
      { property: "og:description", content: "Free, Pro and Student plans for handwritten answer sheets." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight">Simple, student-friendly pricing</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Start free. Upgrade when you need more pages, every handwriting style and watermark-free exports.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={plan.highlighted ? "border-primary p-6 shadow-lift" : "p-6"}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{plan.name}</h2>
                {plan.highlighted && <Badge>Most popular</Badge>}
              </div>
              <p className="mt-3 text-3xl font-extrabold">
                {plan.price}
                <span className="text-base font-medium text-muted-foreground">{plan.period}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="mt-6 block">
                <Button className="w-full" variant={plan.highlighted ? "primary" : "outline"}>
                  {plan.cta}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
