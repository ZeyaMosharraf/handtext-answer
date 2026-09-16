/**
 * DesignPanel — tab navigation and panel composition.
 *
 * Responsibility: render the tab bar and delegate each tab to its
 * focused panel component. Contains no inline field logic, no band
 * mutation logic, and no duplicated code.
 */

import { useState } from "react";
import { BandEditor } from "@/components/editor/design/BandEditor";
import { HandwritingPanel } from "@/components/editor/design/HandwritingPanel";
import { PageSettingsPanel } from "@/components/editor/design/PageSettingsPanel";
import { TableSettingsPanel } from "@/components/editor/design/TableSettingsPanel";
import { TemplatePanel } from "@/components/editor/design/TemplatePanel";
import { type ColumnAlignment, type HandwritingSettings } from "@/lib/handwriting";
import { cn } from "@/lib/utils";

interface Props {
  settings: HandwritingSettings;
  onChange: (next: HandwritingSettings) => void;
  onSaveTemplate: (name: string) => void;
  templates: { id: string; name: string; settings: HandwritingSettings }[];
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  currentPage?: number;
  totalPages?: number;
  content?: string;
  onSetTableColumnAlignment?: (colIndex: number, alignment: ColumnAlignment) => void;
}

type TabId = "handwriting" | "page" | "header" | "footer" | "tables" | "templates";

const TABS: { id: TabId; label: string }[] = [
  { id: "handwriting", label: "Handwriting" },
  { id: "page", label: "Page" },
  { id: "header", label: "Header" },
  { id: "footer", label: "Footer" },
  { id: "tables", label: "Tables" },
  { id: "templates", label: "Templates" },
];

export function DesignPanel({
  settings,
  onChange,
  onSaveTemplate,
  templates,
  onLoadTemplate,
  onDeleteTemplate,
  currentPage = 1,
  totalPages = 1,
  content,
  onSetTableColumnAlignment,
}: Props) {
  const [tab, setTab] = useState<TabId>("handwriting");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Design panel">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === "handwriting" && (
        <HandwritingPanel settings={settings} onChange={onChange} />
      )}

      {tab === "page" && (
        <PageSettingsPanel settings={settings} onChange={onChange} />
      )}

      {tab === "header" && (
        <BandEditor
          which="header"
          settings={settings}
          currentPage={currentPage}
          totalPages={totalPages}
          onChange={onChange}
        />
      )}

      {tab === "footer" && (
        <BandEditor
          which="footer"
          settings={settings}
          currentPage={currentPage}
          totalPages={totalPages}
          onChange={onChange}
        />
      )}

      {tab === "tables" && (
        <TableSettingsPanel
          settings={settings}
          onChange={onChange}
          content={content}
          onSetTableColumnAlignment={onSetTableColumnAlignment}
        />
      )}

      {tab === "templates" && (
        <TemplatePanel
          settings={settings}
          onChange={onChange}
          onSaveTemplate={onSaveTemplate}
          templates={templates}
          onLoadTemplate={onLoadTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      )}
    </div>
  );
}
