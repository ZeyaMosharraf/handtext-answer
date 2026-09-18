/**
 * src/lib/math/digitalRenderer.tsx
 *
 * Digital math renderer for the LEFT document editor.
 *
 * ARCHITECTURE CONTRACT:
 *   MathBlock
 *     │
 *     ├── EDITOR VIEW  → digitalRenderMath()  → clean computer-style JSX
 *     │                  (this file)
 *     │
 *     └── PAGE VIEW    → parseMath() → layoutMath() → box.draw() → handwritten canvas
 *                        (existing pipeline, untouched)
 *
 * Design principles:
 * - Consumes the SAME parseMath() AST as the handwritten renderer — no duplicate parser
 * - Produces clean, native HTML using <span>, inline CSS, and Unicode characters
 * - NO canvas, NO glyph paths, NO handwriting fonts
 * - Fractions rendered as stacked divs with a horizontal rule
 * - Superscripts/subscripts rendered as <sup>/<sub>
 * - Square roots rendered with Unicode radical ✓ + overline CSS
 * - Greek and symbols rendered via Unicode (same as parser mappings)
 * - Error resilient: gracefully returns the LaTeX source on failure
 */

import React from "react";
import type { MathNode, FractionNode, SupSubNode, RootNode, GroupedNode, BigOpNode } from "./types";
import { parseMath } from "./parser";

// ─── Inline style helpers ────────────────────────────────────────────────────

const MATH_FONT: React.CSSProperties = {
  fontFamily: "'STIX Two Math', 'Latin Modern Math', 'Cambria Math', 'Times New Roman', serif",
  fontStyle: "italic",
};

const NUM_FONT: React.CSSProperties = {
  fontFamily: "'STIX Two Math', 'Latin Modern Math', 'Cambria Math', 'Times New Roman', serif",
  fontStyle: "normal",
};

const OP_FONT: React.CSSProperties = {
  fontFamily: "inherit",
  fontStyle: "normal",
};

// ─── AST Node → JSX ─────────────────────────────────────────────────────────

function renderNodes(nodes: MathNode[], key?: string): React.ReactNode {
  return nodes.map((node, i) => renderNode(node, `${key ?? "n"}_${i}`));
}

function renderNode(node: MathNode, key: string): React.ReactNode {
  switch (node.type) {
    case "number":
      return (
        <span key={key} style={NUM_FONT}>
          {node.value}
        </span>
      );

    case "identifier":
      return (
        <span key={key} style={MATH_FONT}>
          {node.value}
        </span>
      );

    case "operator":
      return (
        <span key={key} style={OP_FONT} className="mx-0.5">
          {node.value}
        </span>
      );

    case "symbol": {
      // All Greek and special symbols have a Unicode value stored in node.symbol
      return (
        <span key={key} style={{ ...MATH_FONT, fontStyle: "normal" }}>
          {node.symbol}
        </span>
      );
    }

    case "fraction":
      return renderFraction(node as FractionNode, key);

    case "supsub":
      return renderSupSub(node as SupSubNode, key);

    case "root":
      return renderRoot(node as RootNode, key);

    case "function":
      return (
        <span key={key} style={OP_FONT}>
          <span style={{ fontStyle: "normal" }}>{node.name}</span>
          {node.arg && node.arg.length > 0 && (
            <span style={{ fontStyle: "italic" }}>({renderNodes(node.arg, key + "_arg")})</span>
          )}
        </span>
      );

    case "grouped":
      return renderGrouped(node as GroupedNode, key);

    case "bigOp":
      return renderBigOp(node as BigOpNode, key);

    case "space":
      return (
        <span key={key} style={{ display: "inline-block", width: `${node.widthEm}em` }} />
      );

    default:
      return null;
  }
}

function renderFraction(node: FractionNode, key: string): React.ReactNode {
  return (
    <span
      key={key}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "middle",
        margin: "0 3px",
        lineHeight: 1.1,
      }}
    >
      {/* Numerator */}
      <span
        style={{
          display: "block",
          textAlign: "center",
          paddingBottom: "1px",
          fontSize: "0.88em",
        }}
      >
        {renderNodes(node.numerator, key + "_num")}
      </span>
      {/* Vinculum (fraction bar) */}
      <span
        style={{
          display: "block",
          borderTop: "1px solid currentColor",
          width: "100%",
          minWidth: "1.2em",
        }}
      />
      {/* Denominator */}
      <span
        style={{
          display: "block",
          textAlign: "center",
          paddingTop: "1px",
          fontSize: "0.88em",
        }}
      >
        {renderNodes(node.denominator, key + "_den")}
      </span>
    </span>
  );
}

function renderSupSub(node: SupSubNode, key: string): React.ReactNode {
  const base = renderNodes(node.base, key + "_base");

  // When both sup and sub, display them stacked inline
  if (node.sup && node.sub) {
    return (
      <span key={key} style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
        <span>{base}</span>
        <span
          style={{
            display: "inline-flex",
            flexDirection: "column",
            fontSize: "0.65em",
            lineHeight: 1.1,
            verticalAlign: "middle",
            marginLeft: "0.5px",
          }}
        >
          <span>{renderNodes(node.sup, key + "_sup")}</span>
          <span>{renderNodes(node.sub, key + "_sub")}</span>
        </span>
      </span>
    );
  }

  if (node.sup) {
    return (
      <span key={key}>
        {base}
        <sup style={{ fontSize: "0.65em", lineHeight: 0 }}>
          {renderNodes(node.sup, key + "_sup")}
        </sup>
      </span>
    );
  }

  if (node.sub) {
    return (
      <span key={key}>
        {base}
        <sub style={{ fontSize: "0.65em", lineHeight: 0 }}>
          {renderNodes(node.sub, key + "_sub")}
        </sub>
      </span>
    );
  }

  return <span key={key}>{base}</span>;
}

function renderRoot(node: RootNode, key: string): React.ReactNode {
  const hasIndex = node.index && node.index.length > 0;

  return (
    <span key={key} style={{ display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
      {hasIndex && (
        <sup style={{ fontSize: "0.6em", lineHeight: 0, verticalAlign: "super", marginRight: "1px" }}>
          {renderNodes(node.index!, key + "_idx")}
        </sup>
      )}
      {/* Radical sign */}
      <span style={{ fontStyle: "normal" }}>√</span>
      {/* Radicand with overline */}
      <span
        style={{
          borderTop: "1px solid currentColor",
          paddingTop: "1px",
          paddingLeft: "1px",
          paddingRight: "1px",
        }}
      >
        {renderNodes(node.radicand, key + "_rad")}
      </span>
    </span>
  );
}

function renderGrouped(node: GroupedNode, key: string): React.ReactNode {
  return (
    <span key={key}>
      {node.open && <span style={OP_FONT}>{node.open}</span>}
      {renderNodes(node.body, key + "_body")}
      {node.close && <span style={OP_FONT}>{node.close}</span>}
    </span>
  );
}

const BIG_OP_CHARS: Record<string, string> = {
  sum: "∑",
  prod: "∏",
  integral: "∫",
  oint: "∮",
};

function renderBigOp(node: BigOpNode, key: string): React.ReactNode {
  const char = BIG_OP_CHARS[node.operator] ?? "∑";
  return (
    <span
      key={key}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        verticalAlign: "middle",
        margin: "0 2px",
        fontSize: "0.9em",
        lineHeight: 1.1,
      }}
    >
      {node.upper && (
        <span style={{ fontSize: "0.6em" }}>{renderNodes(node.upper, key + "_up")}</span>
      )}
      <span style={{ fontSize: "1.3em", lineHeight: 1, fontStyle: "normal" }}>{char}</span>
      {node.lower && (
        <span style={{ fontSize: "0.6em" }}>{renderNodes(node.lower, key + "_lo")}</span>
      )}
      {node.operand && <span>{renderNodes(node.operand, key + "_op")}</span>}
    </span>
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface DigitalMathProps {
  /** Parsed AST from parseMath() */
  nodes: MathNode[];
  /** Additional CSS class */
  className?: string;
  /** Optional inline CSS styles (e.g. custom formula ink color) */
  style?: React.CSSProperties | undefined;
}

/**
 * Render a MathNode[] AST as clean digital math JSX.
 *
 * Used exclusively by the LEFT document editor (MathBlockView).
 * The RIGHT handwritten page preview continues to use layoutMath() + box.draw().
 */
export function DigitalMath({ nodes, className, style }: DigitalMathProps): React.ReactElement {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: "nowrap",
        fontSize: "1em",
        lineHeight: 1.5,
        color: "inherit",
        ...style,
      }}
    >
      {renderNodes(nodes, "root")}
    </span>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderNodeToHtml(node: MathNode): string {
  switch (node.type) {
    case "number":
      return `<span style="font-family:'STIX Two Math','Latin Modern Math','Cambria Math','Times New Roman',serif;font-style:normal;">${escapeHtml(node.value)}</span>`;
    case "identifier":
      return `<span style="font-family:'STIX Two Math','Latin Modern Math','Cambria Math','Times New Roman',serif;font-style:italic;">${escapeHtml(node.value)}</span>`;
    case "operator":
      return `<span style="font-style:normal;margin:0 2px;">${escapeHtml(node.value)}</span>`;
    case "symbol":
      return `<span style="font-family:'STIX Two Math','Latin Modern Math','Cambria Math','Times New Roman',serif;font-style:normal;">${escapeHtml(node.symbol)}</span>`;
    case "fraction": {
      const fn = node as FractionNode;
      const num = fn.numerator.map(renderNodeToHtml).join("");
      const den = fn.denominator.map(renderNodeToHtml).join("");
      return `<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 3px;line-height:1.1;"><span style="display:block;text-align:center;padding-bottom:1px;font-size:0.88em;">${num}</span><span style="display:block;border-top:1px solid currentColor;width:100%;min-width:1.2em;"></span><span style="display:block;text-align:center;padding-top:1px;font-size:0.88em;">${den}</span></span>`;
    }
    case "supsub": {
      const sn = node as SupSubNode;
      const base = sn.base.map(renderNodeToHtml).join("");
      if (sn.sup && sn.sub) {
        const sup = sn.sup.map(renderNodeToHtml).join("");
        const sub = sn.sub.map(renderNodeToHtml).join("");
        return `<span style="display:inline-flex;align-items:center;vertical-align:middle;"><span>${base}</span><span style="display:inline-flex;flex-direction:column;font-size:0.65em;line-height:1.1;vertical-align:middle;margin-left:0.5px;"><span>${sup}</span><span>${sub}</span></span></span>`;
      }
      if (sn.sup) {
        const sup = sn.sup.map(renderNodeToHtml).join("");
        return `<span>${base}<sup style="font-size:0.65em;line-height:0;">${sup}</sup></span>`;
      }
      if (sn.sub) {
        const sub = sn.sub.map(renderNodeToHtml).join("");
        return `<span>${base}<sub style="font-size:0.65em;line-height:0;">${sub}</sub></span>`;
      }
      return base;
    }
    case "root": {
      const rn = node as RootNode;
      const rad = rn.radicand.map(renderNodeToHtml).join("");
      const deg = rn.index ? `<sup style="font-size:0.6em;margin-right:-2px;">${rn.index.map(renderNodeToHtml).join("")}</sup>` : "";
      return `<span style="display:inline-flex;align-items:center;vertical-align:middle;">${deg}<span style="font-style:normal;">√</span><span style="border-top:1px solid;padding-top:1px;padding-left:1px;padding-right:1px;">${rad}</span></span>`;
    }
    case "function": {
      const arg = node.arg && node.arg.length > 0 ? `<span style="font-style:italic;">(${node.arg.map(renderNodeToHtml).join("")})</span>` : "";
      return `<span style="font-style:normal;">${escapeHtml(node.name)}</span>${arg}`;
    }
    case "grouped": {
      const gn = node as GroupedNode;
      const body = gn.body.map(renderNodeToHtml).join("");
      const open = gn.open ? escapeHtml(gn.open) : "";
      const close = gn.close ? escapeHtml(gn.close) : "";
      return `<span>${open}${body}${close}</span>`;
    }
    case "bigOp": {
      const bo = node as BigOpNode;
      const char = BIG_OP_CHARS[bo.operator] ?? "∑";
      return `<span style="font-size:1.2em;vertical-align:middle;margin:0 2px;">${escapeHtml(char)}</span>`;
    }
    case "space":
      return `<span style="display:inline-block;width:${node.widthEm}em;"></span>`;
    default:
      return "";
  }
}

/**
 * Renders LaTeX source into clean digital HTML for contenteditable embedding in the LEFT editor.
 */
export function renderDigitalMathToHtml(latex: string): string {
  try {
    const nodes = parseMath(latex);
    if (!nodes || nodes.length === 0) return escapeHtml(latex);
    return `<span style="display:inline-flex;align-items:center;flex-wrap:nowrap;font-size:1em;line-height:1.5;color:inherit;">${nodes.map(renderNodeToHtml).join("")}</span>`;
  } catch {
    return escapeHtml(latex);
  }
}
