import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  answer: z.string().min(1).max(20000),
  action: z.enum([
    "grammar",
    "clarity",
    "expand",
    "shorten",
    "examples",
    "headings",
    "points",
    "academic",
  ]),
});

const INSTRUCTIONS: Record<z.infer<typeof schema>["action"], string> = {
  grammar: "Fix grammar, spelling and punctuation. Keep the meaning and length unchanged.",
  clarity: "Rewrite for clarity and readability while keeping the same facts and structure.",
  expand: "Expand the answer with more depth and detail, roughly 60% longer.",
  shorten: "Make the answer more concise while keeping every key point.",
  examples: "Add short, concrete examples to support the existing points.",
  headings: "Reorganise the answer with clear headings and subheadings.",
  points: "Convert dense paragraphs into clean numbered points and bullets with brief explanations.",
  academic: "Rewrite in a formal academic style suitable for a university assignment.",
};

export const improveAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { text: "", error: "The answer assistant is not available right now." };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You improve students' written answers. Return ONLY the improved answer as plain text. Use '# ' for headings, '## ' for subheadings, '- ' for bullets and '1. ' for numbered points. Never add commentary.",
          },
          { role: "user", content: `${INSTRUCTIONS[data.action]}\n\nAnswer:\n${data.answer}` },
        ],
      }),
    });

    if (response.status === 429) return { text: "", error: "Too many requests — please try again in a moment." };
    if (response.status === 402) return { text: "", error: "AI credits are exhausted for this workspace." };
    if (!response.ok) return { text: "", error: "We couldn't improve your answer right now." };

    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return { text: json.choices?.[0]?.message?.content?.trim() ?? "", error: null as string | null };
  });
