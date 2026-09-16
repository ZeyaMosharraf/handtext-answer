/**
 * TemplatePanel — the "Templates" tab content.
 *
 * Responsibility: physical page templates and user-saved templates.
 */

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import {
  PAGE_TEMPLATES,
  applyTemplate,
  type HandwritingSettings,
} from "@/lib/handwriting";
import { cn } from "@/lib/utils";

interface Props {
  settings: HandwritingSettings;
  onChange: (next: HandwritingSettings) => void;
  onSaveTemplate: (name: string) => void;
  templates: { id: string; name: string; settings: HandwritingSettings }[];
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export function TemplatePanel({
  settings,
  onChange,
  onSaveTemplate,
  templates,
  onLoadTemplate,
  onDeleteTemplate,
}: Props) {
  const [templateName, setTemplateName] = useState("");

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <Label>Physical Paper Templates</Label>
        <div className="grid gap-2">
          {PAGE_TEMPLATES.map((t) => {
            const isSelected = (settings.templateId ?? "assignment") === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(applyTemplate(t.id, settings))}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  {t.badge && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <Label>My templates</Label>
        <div className="flex gap-2">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="My University Answer Sheet"
            aria-label="Template name"
          />
          <Button
            variant="secondary"
            onClick={() => {
              if (!templateName.trim()) return;
              onSaveTemplate(templateName.trim());
              setTemplateName("");
            }}
          >
            Save
          </Button>
        </div>
        {templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Save the current page design to reuse it in other answers.
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLoadTemplate(t.id)}
                  className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {t.name}
                </button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${t.name}`} onClick={() => onDeleteTemplate(t.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
