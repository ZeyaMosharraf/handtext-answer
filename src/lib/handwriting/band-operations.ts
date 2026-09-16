/**
 * Band (header/footer) domain operations.
 *
 * Responsibility: pure functions that query and mutate HandwritingSettings
 * band configuration and page-specific overrides.
 *
 * No React. No Canvas. No layout types.
 * All functions are deterministic: same input → same output.
 */

import {
  STANDARD_FOOTER_HEIGHT,
  STANDARD_HEADER_HEIGHT,
  fontSizeForTextSize,
  getTextSizePreset,
  DEFAULT_PAGE,
  DEFAULT_SETTINGS,
  DEFAULT_HEADER,
  DEFAULT_FOOTER,
  DEFAULT_TABLE,
  type BandConfig,
  type BandOverride,
  type ElementKind,
  type ElementOverride,
  type ElementTextSize,
  type HandwritingSettings,
  type PageBandOverride,
  type PageElement,
  type PageOverridesMap,
  type Slot,
  newElement,
} from "./types";

// ─── Re-exported from types (domain functions that moved here) ───────────────

/** Fill in any missing nested config on projects saved before V2. */
export function withDefaults(partial: Partial<HandwritingSettings> | undefined): HandwritingSettings {
  const s = { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
  const page = { ...DEFAULT_PAGE, ...(partial?.page ?? {}) };
  const cleanedOverrides = cleanupPageOverrides(partial?.pageOverrides);
  return {
    ...s,
    page: {
      ...page,
      ruling: { ...DEFAULT_PAGE.ruling, ...(partial?.page?.ruling ?? {}) },
      margin: { ...DEFAULT_PAGE.margin, ...(partial?.page?.margin ?? {}) },
    },
    header: { ...DEFAULT_HEADER, ...(partial?.header ?? {}) },
    footer: { ...DEFAULT_FOOTER, ...(partial?.footer ?? {}) },
    table: { ...DEFAULT_TABLE, ...(partial?.table ?? {}) },
    ...(cleanedOverrides ? { pageOverrides: cleanedOverrides } : {}),
  };
}

/**
 * Resolves the effective BandConfig for a specific 1-indexed pageNumber by merging
 * global defaults with sparse page-specific overrides.
 */
export function resolveEffectiveBand(
  settings: HandwritingSettings,
  which: "header" | "footer",
  pageNumber: number,
  totalPages: number,
): BandConfig {
  const globalBand = settings[which];
  const pageOverride = settings.pageOverrides?.[pageNumber]?.[which];

  if (!pageOverride) {
    return globalBand;
  }

  const enabled = pageOverride.enabled !== undefined ? pageOverride.enabled : globalBand.enabled;
  const height = pageOverride.height !== undefined ? pageOverride.height : globalBand.height;
  const borderTop = pageOverride.borderTop !== undefined ? pageOverride.borderTop : globalBand.borderTop;
  const borderBottom = pageOverride.borderBottom !== undefined ? pageOverride.borderBottom : globalBand.borderBottom;
  const borderColor = pageOverride.borderColor !== undefined ? pageOverride.borderColor : globalBand.borderColor;

  const hiddenIds = new Set(pageOverride.hiddenElementIds ?? []);
  const elementOverrides = pageOverride.elementOverrides ?? {};

  const mergedElements: PageElement[] = globalBand.elements
    .filter((el) => !hiddenIds.has(el.id))
    .map((el) => {
      const override = elementOverrides[el.id];
      if (!override) return el;
      const patched = { ...el };
      if (override.value !== undefined) patched.value = override.value;
      if (override.label !== undefined) patched.label = override.label;
      if (override.slot !== undefined) patched.slot = override.slot;
      if (override.row !== undefined) patched.row = override.row;
      if (override.textSize !== undefined) {
        patched.textSize = override.textSize;
        patched.fontSize = fontSizeForTextSize(override.textSize);
      } else if (override.fontSize !== undefined) {
        patched.fontSize = override.fontSize;
        patched.textSize = getTextSizePreset(override.fontSize);
      }
      if (override.color !== undefined) patched.color = override.color;
      if (override.handwritten !== undefined) patched.handwritten = override.handwritten;
      if (override.enabled !== undefined) patched.enabled = override.enabled;
      if (override.format !== undefined) patched.format = override.format;
      if (override.startPageNumber !== undefined) patched.startPageNumber = override.startPageNumber;
      return patched;
    });

  if (pageOverride.extraElements && pageOverride.extraElements.length > 0) {
    mergedElements.push(...pageOverride.extraElements);
  }

  return {
    ...globalBand,
    enabled,
    height,
    borderTop,
    borderBottom,
    borderColor,
    elements: mergedElements,
  };
}

/**
 * Prunes empty overrides and cleans up empty page records to prevent payload bloat.
 */
export function cleanupPageOverrides(overrides?: PageOverridesMap): PageOverridesMap | undefined {
  if (!overrides) return undefined;
  const cleaned: PageOverridesMap = {};
  let hasAny = false;

  for (const [pageKey, pageRecord] of Object.entries(overrides)) {
    const pageNum = Number(pageKey);
    if (isNaN(pageNum) || !pageRecord) continue;

    const pageCleaned: PageBandOverride = {};
    let pageHasAny = false;

    for (const which of ["header", "footer"] as const) {
      const band = pageRecord[which];
      if (!band) continue;

      const hasEnabled = band.enabled !== undefined;
      const hasHeight = band.height !== undefined;
      const hasBorders = band.borderTop !== undefined || band.borderBottom !== undefined || band.borderColor !== undefined;
      const hasElemOverrides = band.elementOverrides && Object.keys(band.elementOverrides).length > 0;
      const hasExtra = band.extraElements && band.extraElements.length > 0;
      const hasHidden = band.hiddenElementIds && band.hiddenElementIds.length > 0;

      if (hasEnabled || hasHeight || hasBorders || hasElemOverrides || hasExtra || hasHidden) {
        pageCleaned[which] = band;
        pageHasAny = true;
      }
    }

    if (pageHasAny) {
      cleaned[pageNum] = pageCleaned;
      hasAny = true;
    }
  }

  return hasAny ? cleaned : undefined;
}

// ─── Shared page override helpers ────────────────────────────────────────────

/** Returns true if this band override has any meaningful overriding content. */
export function computeHasOverride(pageOverride: BandOverride | undefined): boolean {
  if (!pageOverride) return false;
  return (
    pageOverride.enabled !== undefined ||
    (pageOverride.elementOverrides != null && Object.keys(pageOverride.elementOverrides).length > 0) ||
    (pageOverride.extraElements != null && pageOverride.extraElements.length > 0) ||
    (pageOverride.hiddenElementIds != null && pageOverride.hiddenElementIds.length > 0)
  );
}

/**
 * Applies a page-specific band override mutator and writes it back into settings.
 * Handles cleanup of empty override records automatically.
 */
export function applyBandOverride(
  settings: HandwritingSettings,
  which: "header" | "footer",
  currentPage: number,
  updater: (prev: BandOverride) => BandOverride,
): HandwritingSettings {
  const currentOverride = settings.pageOverrides?.[currentPage]?.[which] ?? {};
  const updatedOverride = updater(currentOverride);

  const hasContent =
    updatedOverride.enabled !== undefined ||
    updatedOverride.height !== undefined ||
    updatedOverride.borderTop !== undefined ||
    updatedOverride.borderBottom !== undefined ||
    updatedOverride.borderColor !== undefined ||
    (updatedOverride.elementOverrides != null && Object.keys(updatedOverride.elementOverrides).length > 0) ||
    (updatedOverride.extraElements != null && updatedOverride.extraElements.length > 0) ||
    (updatedOverride.hiddenElementIds != null && updatedOverride.hiddenElementIds.length > 0);

  const nextOverrides: PageOverridesMap = { ...(settings.pageOverrides ?? {}) };
  const currentPageRecord: PageBandOverride = { ...(nextOverrides[currentPage] ?? {}) };

  if (hasContent) {
    currentPageRecord[which] = updatedOverride;
    nextOverrides[currentPage] = currentPageRecord;
  } else {
    delete currentPageRecord[which];
    if (Object.keys(currentPageRecord).length > 0) {
      nextOverrides[currentPage] = currentPageRecord;
    } else {
      delete nextOverrides[currentPage];
    }
  }

  const cleaned = cleanupPageOverrides(nextOverrides);
  const next: HandwritingSettings = { ...settings };
  if (cleaned) {
    next.pageOverrides = cleaned;
  } else {
    delete next.pageOverrides;
  }
  return next;
}

// ─── Band enable/disable ─────────────────────────────────────────────────────

export function setBandEnabled(
  settings: HandwritingSettings,
  which: "header" | "footer",
  scope: "all" | "page",
  currentPage: number,
  checked: boolean,
): HandwritingSettings {
  const globalBand = settings[which];
  const standardHeight = which === "header" ? STANDARD_HEADER_HEIGHT : STANDARD_FOOTER_HEIGHT;
  const defaultBorderKey = which === "header" ? "borderBottom" : "borderTop";

  if (scope === "all") {
    return {
      ...settings,
      [which]: {
        ...globalBand,
        enabled: checked,
        height: globalBand.height && globalBand.height > 0 ? globalBand.height : standardHeight,
        [defaultBorderKey]: (globalBand as any)[defaultBorderKey] !== undefined ? (globalBand as any)[defaultBorderKey] : true,
        borderColor: globalBand.borderColor || "#c9ced6",
      },
    };
  }

  return applyBandOverride(settings, which, currentPage, (prev) => {
    if (checked === globalBand.enabled) {
      const { enabled: _e, ...rest } = prev;
      return rest;
    }
    return { ...prev, enabled: checked };
  });
}

// ─── Band element operations ──────────────────────────────────────────────────

function defaultSlotForKind(which: "header" | "footer", kind: ElementKind): Slot {
  if (which === "header") {
    return kind === "date" || kind === "pageNumber" || kind === "signature" ? "right" : "left";
  }
  // footer
  return kind === "pageNumber" || kind === "date" || kind === "signature" ? "right" : "left";
}

export function addBandElement(
  settings: HandwritingSettings,
  which: "header" | "footer",
  scope: "all" | "page",
  currentPage: number,
  kind: ElementKind,
  displayedBand: BandConfig,
): HandwritingSettings {
  const globalBand = settings[which];
  const standardHeight = which === "header" ? STANDARD_HEADER_HEIGHT : STANDARD_FOOTER_HEIGHT;
  const defaultBorderKey = which === "header" ? "borderBottom" : "borderTop";
  const slot = defaultSlotForKind(which, kind);
  const existingInSlot = displayedBand.elements.filter((e) => (slot === "right" ? e.slot === "right" : e.slot !== "right"));
  const row = existingInSlot.length;

  const newEl = newElement(kind, {
    slot,
    row,
    fontSize: 20,
    textSize: "normal",
    color: "#333333",
    handwritten: false,
    enabled: true,
    ...(kind === "pageNumber" ? { format: "n", label: "Page No.", startPageNumber: 1 } : {}),
    ...(kind === "text" ? { label: "", value: "Custom text" } : {}),
  });

  if (scope === "all") {
    return {
      ...settings,
      [which]: {
        ...globalBand,
        enabled: true,
        height: globalBand.height && globalBand.height > 0 ? globalBand.height : standardHeight,
        [defaultBorderKey]: (globalBand as any)[defaultBorderKey] !== undefined ? (globalBand as any)[defaultBorderKey] : true,
        elements: [...globalBand.elements, newEl],
      },
    };
  }

  return applyBandOverride(settings, which, currentPage, (prev) => ({
    ...prev,
    enabled: prev.enabled !== undefined ? prev.enabled : (globalBand.enabled ? undefined : true),
    extraElements: [...(prev.extraElements ?? []), newEl],
  }));
}

export function deleteBandElement(
  settings: HandwritingSettings,
  which: "header" | "footer",
  scope: "all" | "page",
  currentPage: number,
  id: string,
  globalBandElements: PageElement[],
): HandwritingSettings {
  const globalBand = settings[which];

  if (scope === "all") {
    return {
      ...settings,
      [which]: {
        ...globalBand,
        elements: globalBand.elements.filter((x) => x.id !== id),
      },
    };
  }

  return applyBandOverride(settings, which, currentPage, (prev) => {
    const isExtra = prev.extraElements?.some((e) => e.id === id);
    if (isExtra) {
      const nextExtra = prev.extraElements?.filter((e) => e.id !== id);
      return { ...prev, extraElements: nextExtra && nextExtra.length > 0 ? nextExtra : undefined };
    }

    const hidden = new Set(prev.hiddenElementIds ?? []);
    hidden.add(id);
    const nextElemOverrides = { ...(prev.elementOverrides ?? {}) };
    delete nextElemOverrides[id];
    return {
      ...prev,
      hiddenElementIds: Array.from(hidden),
      elementOverrides: Object.keys(nextElemOverrides).length > 0 ? nextElemOverrides : undefined,
    };
  });
}

function normalizeRows(elements: PageElement[]): PageElement[] {
  let leftCount = 0;
  let centerCount = 0;
  let rightCount = 0;
  return elements.map((el) => {
    if (el.slot === "right") return { ...el, row: rightCount++ };
    if (el.slot === "center") return { ...el, row: centerCount++ };
    return { ...el, row: leftCount++ };
  });
}

export function moveBandElement(
  settings: HandwritingSettings,
  which: "header" | "footer",
  scope: "all" | "page",
  currentPage: number,
  id: string,
  direction: "up" | "down",
  displayedBand: BandConfig,
): HandwritingSettings {
  const globalBand = settings[which];
  const currentElements = [...displayedBand.elements];
  const idx = currentElements.findIndex((e) => e.id === id);
  if (idx === -1) return settings;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= currentElements.length) return settings;

  const currentEl = currentElements[idx]!;
  const targetEl = currentElements[targetIdx]!;
  currentElements[idx] = targetEl;
  currentElements[targetIdx] = currentEl;
  const normalized = normalizeRows(currentElements);

  if (scope === "all") {
    return { ...settings, [which]: { ...globalBand, elements: normalized } };
  }

  return applyBandOverride(settings, which, currentPage, (prev) => {
    const extraIds = new Set(prev.extraElements?.map((e) => e.id) ?? []);
    const nextExtra = (prev.extraElements ?? []).map((extraEl) => {
      const norm = normalized.find((e) => e.id === extraEl.id);
      return norm ? { ...extraEl, row: norm.row } : extraEl;
    });
    const nextOverrides = { ...(prev.elementOverrides ?? {}) };
    for (const el of normalized) {
      if (!extraIds.has(el.id)) {
        const globalEl = globalBand.elements.find((g) => g.id === el.id);
        const currentElOverride = nextOverrides[el.id];
        if (globalEl && globalEl.row !== el.row) {
          nextOverrides[el.id] = { ...(currentElOverride ?? {}), row: el.row };
        } else if (currentElOverride) {
          const { row: _r, ...rest } = currentElOverride;
          if (Object.keys(rest).length > 0) {
            nextOverrides[el.id] = rest;
          } else {
            delete nextOverrides[el.id];
          }
        }
      }
    }
    return {
      ...prev,
      extraElements: nextExtra.length > 0 ? nextExtra : undefined,
      elementOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    };
  });
}

export function updateBandElement(
  settings: HandwritingSettings,
  which: "header" | "footer",
  scope: "all" | "page",
  currentPage: number,
  id: string,
  patch: Partial<PageElement>,
  globalBandElements: PageElement[],
): HandwritingSettings {
  const globalBand = settings[which];

  if (scope === "all") {
    return {
      ...settings,
      [which]: {
        ...globalBand,
        elements: globalBand.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      },
    };
  }

  return applyBandOverride(settings, which, currentPage, (prev) => {
    const isExtra = prev.extraElements?.some((e) => e.id === id);
    if (isExtra) {
      return { ...prev, extraElements: (prev.extraElements ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)) };
    }

    const globalEl = globalBandElements.find((e) => e.id === id);
    if (!globalEl) return prev;

    const currentElemOverride = prev.elementOverrides?.[id] ?? {};
    const nextElemOverride: ElementOverride = { ...currentElemOverride, ...patch };

    for (const key of Object.keys(nextElemOverride) as (keyof ElementOverride)[]) {
      const globalVal =
        (globalEl as any)[key] ??
        (key === "textSize" ? "normal" : key === "fontSize" ? 20 : undefined);
      if (nextElemOverride[key] === globalVal) {
        delete nextElemOverride[key];
      }
    }

    const nextElemOverrides = { ...(prev.elementOverrides ?? {}) };
    if (Object.keys(nextElemOverride).length > 0) {
      nextElemOverrides[id] = nextElemOverride;
    } else {
      delete nextElemOverrides[id];
    }

    return {
      ...prev,
      elementOverrides: Object.keys(nextElemOverrides).length > 0 ? nextElemOverrides : undefined,
    };
  });
}

export function resetBandToGlobal(
  settings: HandwritingSettings,
  which: "header" | "footer",
  currentPage: number,
): HandwritingSettings {
  if (!settings.pageOverrides?.[currentPage]?.[which]) return settings;

  const nextOverrides: PageOverridesMap = { ...(settings.pageOverrides ?? {}) };
  const currentPageRecord: PageBandOverride = { ...(nextOverrides[currentPage] ?? {}) };
  delete currentPageRecord[which];

  if (Object.keys(currentPageRecord).length > 0) {
    nextOverrides[currentPage] = currentPageRecord;
  } else {
    delete nextOverrides[currentPage];
  }

  const cleaned = cleanupPageOverrides(nextOverrides);
  const next: HandwritingSettings = { ...settings };
  if (cleaned) {
    next.pageOverrides = cleaned;
  } else {
    delete next.pageOverrides;
  }
  return next;
}

export function restoreHiddenElement(
  settings: HandwritingSettings,
  which: "header" | "footer",
  currentPage: number,
  hiddenId: string,
): HandwritingSettings {
  return applyBandOverride(settings, which, currentPage, (prev) => {
    const nextHidden = prev.hiddenElementIds?.filter((id) => id !== hiddenId);
    return { ...prev, hiddenElementIds: nextHidden && nextHidden.length > 0 ? nextHidden : undefined };
  });
}

// ─── Text size helpers shared between scope modes ────────────────────────────

/**
 * Builds the correct patch for a text size change depending on scope.
 * In "all" scope, the fontSize is also updated (source of truth).
 * In "page" scope, only textSize is stored in the sparse override.
 */
export function textSizePatch(
  nextSize: ElementTextSize,
  scope: "all" | "page",
): Partial<PageElement> {
  if (scope === "all") {
    return { textSize: nextSize, fontSize: fontSizeForTextSize(nextSize) };
  }
  return { textSize: nextSize };
}
