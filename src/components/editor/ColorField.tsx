import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  presets?: { label: string; value: string }[];
  className?: string;
}

export function ColorField({ label, value, onChange, presets, className }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded-md border border-border bg-card p-1"
        />
        <input
          type="text"
          aria-label={`${label} hex value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="h-9 w-full rounded-md border border-border bg-card px-2 font-mono text-xs uppercase"
        />
      </div>
      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => onChange(p.value)}
              className={cn(
                "size-6 rounded-full border",
                value.toLowerCase() === p.value.toLowerCase() ? "border-primary ring-2 ring-primary/40" : "border-border",
              )}
              style={{ backgroundColor: p.value }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
