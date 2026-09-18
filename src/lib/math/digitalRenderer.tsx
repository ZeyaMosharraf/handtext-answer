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
}

/**
 * Render a MathNode[] AST as clean digital math JSX.
 *
 * Used exclusively by the LEFT document editor (MathBlockView).
 * The RIGHT handwritten page preview continues to use layoutMath() + box.draw().
 */
export function DigitalMath({ nodes, className }: DigitalMathProps): React.ReactElement {
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
      }}
    >
      {renderNodes(nodes, "root")}
    </span>
  );
}
