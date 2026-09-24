export interface Plan {
  id: "free" | "pro" | "student";
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  monthlyPageLimit: number | null;
}

/**
 * Plan definitions live in one place so limits stay configurable.
 * For the current launch validation period, HandText operates on free access.
 * Paid subscriptions are disabled until payment infrastructure is activated.
 */
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Access",
    price: "₹0",
    period: "",
    tagline: "Full access during public launch validation.",
    features: [
      "Unlimited pages",
      "All handwriting styles",
      "Ruled, blank & grid paper",
      "LaTeX math equations & tables",
      "High-resolution PDF & PNG exports",
      "Cloud project save & autosave",
    ],
    cta: "Start Free",
    monthlyPageLimit: null,
  },
];

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}
