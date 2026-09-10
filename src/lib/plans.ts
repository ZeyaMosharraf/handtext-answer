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
 * Plan definitions live in one place so limits stay configurable and are never
 * scattered as hardcoded business rules across the UI.
 */
export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "/month",
    tagline: "Try it on your next assignment.",
    features: [
      "Up to 20 pages per month",
      "3 handwriting styles",
      "Basic customisation",
      "PDF and PNG export",
      "Small watermark",
    ],
    cta: "Start free",
    monthlyPageLimit: 20,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹399",
    period: "/month",
    tagline: "For regular assignment writing.",
    features: [
      "Unlimited pages",
      "All handwriting styles",
      "Advanced customisation",
      "High-resolution exports",
      "No watermark",
      "Saved projects and autosave",
    ],
    cta: "Go Pro",
    highlighted: true,
    monthlyPageLimit: null,
  },
  {
    id: "student",
    name: "Student",
    price: "₹199",
    period: "/month",
    tagline: "Verified students, half price.",
    features: [
      "Everything in Pro",
      "500 pages per month",
      "Student email verification",
      "Priority generation",
    ],
    cta: "Get student plan",
    monthlyPageLimit: 500,
  },
];

export function planById(id: string): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}
