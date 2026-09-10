import { withDefaults, type HandwritingSettings } from "@/lib/handwriting";

export interface SavedTemplate {
  id: string;
  name: string;
  settings: HandwritingSettings;
}

const KEY = "handtext.templates.v2";

export function loadTemplates(): SavedTemplate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedTemplate[];
    return raw.map((t) => ({ ...t, settings: withDefaults(t.settings) }));
  } catch {
    return [];
  }
}

export function persistTemplates(templates: SavedTemplate[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(templates));
}
