import { useEffect, useRef, useState } from "react";

import { DEFAULT_SETTINGS, renderPages, styleSettings, type HandwritingSettings } from "@/lib/handwriting";

interface Props {
  text: string;
  question?: string;
  styleId?: string;
  overrides?: Partial<HandwritingSettings>;
  className?: string;
  alt?: string;
}

/** Client-side preview of the handwriting engine, used on the landing page. */
export function HandwrittenSample({ text, question, styleId = "natural", overrides, className, alt }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const settings = { ...styleSettings(styleId, DEFAULT_SETTINGS), ...overrides };
    renderPages({ content: text, ...(question ? { question } : {}), settings })
      .then((pages) => {
        if (mounted.current && pages[0]) setSrc(pages[0].canvas.toDataURL("image/png"));
      })
      .catch(() => undefined);
    return () => {
      mounted.current = false;
    };
  }, [text, question, styleId, overrides]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-[#fdfcf7] shadow-lift ${className ?? ""}`}
    >
      {src ? (
        <img src={src} alt={alt ?? "Generated handwritten page example"} className="block w-full" loading="lazy" />
      ) : (
        <div className="aspect-[1240/1754] w-full animate-pulse bg-muted" aria-hidden />
      )}
    </div>
  );
}
