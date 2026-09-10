import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button, Card, Spinner } from "@/components/ui/primitives";
import { improveAnswer } from "@/lib/ai.functions";

const ACTIONS = [
  { id: "grammar", label: "Improve grammar" },
  { id: "clarity", label: "Make clearer" },
  { id: "expand", label: "Expand" },
  { id: "shorten", label: "Shorten" },
  { id: "examples", label: "Add examples" },
  { id: "headings", label: "Add headings" },
  { id: "points", label: "Convert to points" },
  { id: "academic", label: "Academic tone" },
] as const;

type ActionId = (typeof ACTIONS)[number]["id"];

export function AiAssistant({ answer, onUse }: { answer: string; onUse: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const run = useServerFn(improveAnswer);

  const request = async (action: ActionId) => {
    if (!answer.trim()) {
      toast.error("Write your answer first, then the assistant can improve it.");
      return;
    }
    setBusy(action);
    try {
      const result = await run({ data: { answer, action } });
      if (result.error || !result.text) {
        toast.error(result.error ?? "We couldn't improve your answer right now.");
      } else {
        setSuggestion(result.text);
      }
    } catch {
      toast.error("The assistant is unreachable. Your answer is safe — please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Sparkles className="size-4" /> Improve answer
      </Button>

      {open && (
        <Card className="space-y-3 p-3">
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => (
              <Button key={a.id} size="sm" variant="secondary" disabled={busy !== null} onClick={() => request(a.id)}>
                {busy === a.id ? <Spinner /> : null}
                {a.label}
              </Button>
            ))}
          </div>

          {suggestion && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggested version
              </p>
              <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm">
                {suggestion}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    onUse(suggestion);
                    setSuggestion(null);
                    toast.success("Improved answer applied.");
                  }}
                >
                  Use improved answer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                  Keep my answer
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
