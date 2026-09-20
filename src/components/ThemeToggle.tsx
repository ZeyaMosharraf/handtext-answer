import React from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  align?: "start" | "center" | "end";
}

export function ThemeToggle({ className, align = "end" }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-9 rounded-lg cursor-pointer", className)}
          aria-label={`Current theme: ${theme}. Click to change theme.`}
          title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
        >
          {theme === "system" ? (
            <Monitor className="size-4 text-muted-foreground transition-transform hover:scale-105" />
          ) : resolvedTheme === "dark" ? (
            <Moon className="size-4 text-foreground transition-transform hover:scale-105" />
          ) : (
            <Sun className="size-4 text-foreground transition-transform hover:scale-105" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[130px] rounded-lg border border-border bg-popover p-1 shadow-lg text-popover-foreground">
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Sun className="size-3.5" />
            <span>Light</span>
          </div>
          {theme === "light" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Moon className="size-3.5" />
            <span>Dark</span>
          </div>
          {theme === "dark" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="flex items-center justify-between gap-2 rounded px-2.5 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent hover:text-accent-foreground"
        >
          <div className="flex items-center gap-2">
            <Monitor className="size-3.5" />
            <span>System</span>
          </div>
          {theme === "system" && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const options: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "Light", icon: <Sun className="size-4" /> },
    { id: "dark", label: "Dark", icon: <Moon className="size-4" /> },
    { id: "system", label: "System", icon: <Monitor className="size-4" /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode selection"
      className={cn("grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-1", className)}
    >
      {options.map((opt) => {
        const isSelected = theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(opt.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg p-3 text-xs font-medium transition-all cursor-pointer",
              isSelected
                ? "bg-card text-foreground shadow-xs ring-2 ring-primary/40"
                : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
            )}
          >
            <span className={isSelected ? "text-primary" : "text-muted-foreground"}>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
