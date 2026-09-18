import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, Input } from "@/components/ui/primitives";
import { compileExpression } from "@/lib/graph/parser";
import { makeCoordTransform, computeTickSpec, sampleFunction, segmentizeSamples } from "@/lib/graph/geometry";
import type { GraphDefinition, GraphType } from "@/lib/graph/types";

export interface GraphInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (definition: GraphDefinition) => void;
  initialDefinition?: GraphDefinition | undefined;
}

interface PointRow {
  x: string;
  y: string;
  label: string;
  connect: boolean;
}

const QUICK_FUNCTIONS = [
  { label: "x²", expr: "x^2", yMin: -2, yMax: 26 },
  { label: "2x+1", expr: "2*x + 1", yMin: -10, yMax: 12 },
  { label: "sin(x)", expr: "sin(x)", yMin: -1.5, yMax: 1.5 },
  { label: "cos(x)", expr: "cos(x)", yMin: -1.5, yMax: 1.5 },
  { label: "tan(x)", expr: "tan(x)", yMin: -5, yMax: 5 },
  { label: "√x", expr: "sqrt(x)", yMin: -1, yMax: 4 },
  { label: "1/x", expr: "1/x", yMin: -6, yMax: 6 },
  { label: "x³", expr: "x^3", yMin: -30, yMax: 30 },
  { label: "eˣ", expr: "exp(x)", yMin: -1, yMax: 30 },
  { label: "ln(x)", expr: "ln(x)", yMin: -4, yMax: 3 },
];

export function GraphInsertModal({
  isOpen,
  onClose,
  onInsert,
  initialDefinition,
}: GraphInsertModalProps) {
  const [type, setType] = useState<GraphType>(initialDefinition?.type ?? "function");
  const [title, setTitle] = useState(initialDefinition?.title ?? "");
  const [xLabel, setXLabel] = useState(initialDefinition?.xLabel ?? "x");
  const [yLabel, setYLabel] = useState(initialDefinition?.yLabel ?? "y");

  const [expression, setExpression] = useState(
    initialDefinition?.functions?.[0]?.expression ?? "x^2",
  );
  const [expressionError, setExpressionError] = useState<string | null>(null);

  const [xMin, setXMin] = useState(initialDefinition?.space?.xMin ?? -5);
  const [xMax, setXMax] = useState(initialDefinition?.space?.xMax ?? 5);
  const [yMin, setYMin] = useState(initialDefinition?.space?.yMin ?? -2);
  const [yMax, setYMax] = useState(initialDefinition?.space?.yMax ?? 26);

  const [showGrid, setShowGrid] = useState(initialDefinition?.space?.showGrid ?? true);
  const [showAxisLabels, setShowAxisLabels] = useState(
    initialDefinition?.space?.showAxisLabels ?? true,
  );

  const [points, setPoints] = useState<PointRow[]>(
    initialDefinition?.points && initialDefinition.points.length > 0
      ? initialDefinition.points.map((p) => ({
          x: String(p.x),
          y: String(p.y),
          label: p.label ?? "",
          connect: p.connect,
        }))
      : [
          { x: "0", y: "0", label: "O", connect: false },
          { x: "2", y: "4", label: "A", connect: true },
          { x: "4", y: "8", label: "B", connect: true },
          { x: "6", y: "12", label: "C", connect: true },
        ],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Validate expression on change
  useEffect(() => {
    if (type !== "function") {
      setExpressionError(null);
      return;
    }
    const trimmed = expression.trim();
    if (!trimmed) {
      setExpressionError("Expression cannot be empty");
      return;
    }
    try {
      const compiled = compileExpression(trimmed);
      compiled.evaluate(0);
      setExpressionError(null);
    } catch (err: any) {
      setExpressionError(err?.message ?? "Invalid mathematical expression");
    }
  }, [expression, type]);

  // Live Technical Preview Canvas (Digital)
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 360;
    const cssHeight = 220;

    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const padL = 36;
    const padR = 16;
    const padT = title ? 28 : 16;
    const padB = 28;
    const graphW = Math.max(10, cssWidth - padL - padR);
    const graphH = Math.max(10, cssHeight - padT - padB);

    const safeXMin = Number.isFinite(xMin) ? xMin : -5;
    const safeXMax = Number.isFinite(xMax) && xMax > safeXMin ? xMax : safeXMin + 10;
    const safeYMin = Number.isFinite(yMin) ? yMin : -5;
    const safeYMax = Number.isFinite(yMax) && yMax > safeYMin ? yMax : safeYMin + 10;

    const space = {
      xMin: safeXMin,
      xMax: safeXMax,
      yMin: safeYMin,
      yMax: safeYMax,
      showGrid,
      showAxisLabels,
      originVisible: true,
    };

    const transform = makeCoordTransform(space, padL, padT, graphW, graphH);

    // Title
    if (title) {
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 12px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(title, cssWidth / 2, 16);
    }

    // Grid
    const xTicks = computeTickSpec(safeXMin, safeXMax);
    const yTicks = computeTickSpec(safeYMin, safeYMax);

    if (showGrid) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      for (const tx of xTicks.ticks) {
        const cx = transform.toCanvasX(tx);
        ctx.beginPath();
        ctx.moveTo(cx, padT);
        ctx.lineTo(cx, padT + graphH);
        ctx.stroke();
      }
      for (const ty of yTicks.ticks) {
        const cy = transform.toCanvasY(ty);
        ctx.beginPath();
        ctx.moveTo(padL, cy);
        ctx.lineTo(padL + graphW, cy);
        ctx.stroke();
      }
    }

    // Axes
    let axisY = transform.toCanvasY(0);
    if (0 < safeYMin) axisY = padT + graphH;
    if (0 > safeYMax) axisY = padT;

    let axisX = transform.toCanvasX(0);
    if (0 < safeXMin) axisX = padL;
    if (0 > safeXMax) axisX = padL + graphW;

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;

    // X Axis
    ctx.beginPath();
    ctx.moveTo(padL, axisY);
    ctx.lineTo(padL + graphW, axisY);
    ctx.stroke();

    // Y Axis
    ctx.beginPath();
    ctx.moveTo(axisX, padT + graphH);
    ctx.lineTo(axisX, padT);
    ctx.stroke();

    // Ticks & Labels
    if (showAxisLabels) {
      ctx.fillStyle = "#64748b";
      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const tx of xTicks.ticks) {
        const cx = transform.toCanvasX(tx);
        ctx.beginPath();
        ctx.moveTo(cx, axisY - 3);
        ctx.lineTo(cx, axisY + 3);
        ctx.stroke();
        if (tx !== 0) {
          ctx.fillText(String(tx), cx, Math.min(cssHeight - 4, axisY + 14));
        }
      }

      ctx.textAlign = "right";
      for (const ty of yTicks.ticks) {
        const cy = transform.toCanvasY(ty);
        ctx.beginPath();
        ctx.moveTo(axisX - 3, cy);
        ctx.lineTo(axisX + 3, cy);
        ctx.stroke();
        if (ty !== 0) {
          ctx.fillText(String(ty), Math.max(padL - 4, axisX - 6), cy + 3);
        }
      }
    }

    // Axis Names
    if (xLabel) {
      ctx.fillStyle = "#334155";
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(xLabel, padL + graphW, axisY - 6);
    }
    if (yLabel) {
      ctx.fillStyle = "#334155";
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(yLabel, axisX + 6, padT + 12);
    }

    // Function Plot
    if (type === "function" && expression.trim() && !expressionError) {
      try {
        const compiled = compileExpression(expression.trim());
        const samples = sampleFunction(compiled, space, transform, 200);
        const segments = segmentizeSamples(samples);

        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        for (const seg of segments) {
          ctx.beginPath();
          seg.points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.cx, pt.cy);
            else ctx.lineTo(pt.cx, pt.cy);
          });
          ctx.stroke();
        }
      } catch {}
    }

    // Points Plot
    if ((type === "points" || type === "scatter") && points.length > 0) {
      const validPoints = points
        .map((p) => ({
          x: parseFloat(p.x),
          y: parseFloat(p.y),
          label: p.label,
          connect: p.connect,
        }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

      ctx.strokeStyle = "#059669";
      ctx.fillStyle = "#059669";
      ctx.lineWidth = 1.5;

      let prev: { cx: number; cy: number } | null = null;
      for (const pt of validPoints) {
        const cx = transform.toCanvasX(pt.x);
        const cy = transform.toCanvasY(pt.y);

        if (type === "scatter") {
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Cross marker
          ctx.beginPath();
          ctx.moveTo(cx - 3.5, cy - 3.5);
          ctx.lineTo(cx + 3.5, cy + 3.5);
          ctx.moveTo(cx - 3.5, cy + 3.5);
          ctx.lineTo(cx + 3.5, cy - 3.5);
          ctx.stroke();
        }

        if (pt.connect && prev) {
          ctx.beginPath();
          ctx.moveTo(prev.cx, prev.cy);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }

        if (pt.label) {
          ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
          ctx.fillText(pt.label, cx + 5, cy - 5);
        }

        prev = { cx, cy };
      }
    }

    ctx.restore();
  }, [
    type,
    title,
    xLabel,
    yLabel,
    expression,
    expressionError,
    xMin,
    xMax,
    yMin,
    yMax,
    showGrid,
    showAxisLabels,
    points,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(drawPreview, 50);
    return () => clearTimeout(timer);
  }, [isOpen, drawPreview]);

  const handleSelectType = (newType: GraphType) => {
    setType(newType);
    if (newType === "function") {
      setXMin(-5);
      setXMax(5);
      setYMin(-2);
      setYMax(26);
    } else if (newType === "coordinate") {
      setXMin(-5);
      setXMax(5);
      setYMin(-5);
      setYMax(5);
    } else {
      setXMin(0);
      setXMax(10);
      setYMin(0);
      setYMax(15);
    }
  };

  const handleInsert = () => {
    if (type === "function" && expressionError) return;

    const definition: GraphDefinition = {
      id: crypto.randomUUID(),
      type,
      space: {
        xMin,
        xMax,
        yMin,
        yMax,
        showGrid,
        showAxisLabels,
        originVisible: true,
      },
    };

    if (title.trim()) definition.title = title.trim();
    if (xLabel.trim()) definition.xLabel = xLabel.trim();
    if (yLabel.trim()) definition.yLabel = yLabel.trim();

    if (type === "function" && expression.trim()) {
      definition.functions = [{ expression: expression.trim(), label: `y = ${expression.trim()}` }];
    }

    if (type === "points" || type === "scatter") {
      definition.points = points
        .map((p) => {
          const pt: { x: number; y: number; label?: string; connect: boolean } = {
            x: parseFloat(p.x),
            y: parseFloat(p.y),
            connect: p.connect,
          };
          if (p.label.trim()) pt.label = p.label.trim();
          return pt;
        })
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    }

    onInsert(definition);
    onClose();
  };

  const handleAddPoint = () => {
    setPoints((prev) => [...prev, { x: "0", y: "0", label: "", connect: true }]);
  };

  const handleRemovePoint = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <span>📈</span> Insert Handwritten Graph
          </DialogTitle>
        </DialogHeader>

        {/* Graph Type Tabs */}
        <div className="flex gap-1.5 p-1 bg-muted rounded-lg text-xs">
          <button
            type="button"
            onClick={() => handleSelectType("function")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              type === "function"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Function Plot
          </button>
          <button
            type="button"
            onClick={() => handleSelectType("coordinate")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              type === "coordinate"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Coordinate Axes
          </button>
          <button
            type="button"
            onClick={() => handleSelectType("points")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              type === "points"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Line Graph (Points)
          </button>
          <button
            type="button"
            onClick={() => handleSelectType("scatter")}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              type === "scatter"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Scatter Plot
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
          {/* Controls Column */}
          <div className="space-y-3 text-xs">
            {/* Function input */}
            {type === "function" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Function Expression (y = f(x))
                </label>
                <div className="relative">
                  <Input
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    placeholder="e.g. x^2, sin(x), 2*x + 1"
                    className={`font-mono text-sm h-8 ${
                      expressionError ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                  />
                </div>
                {expressionError && (
                  <p className="text-[11px] text-destructive font-medium">{expressionError}</p>
                )}

                {/* Quick Function Chips */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {QUICK_FUNCTIONS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        setExpression(q.expr);
                        setYMin(q.yMin);
                        setYMax(q.yMax);
                      }}
                      className="px-2 py-0.5 rounded bg-secondary/80 hover:bg-secondary text-[11px] font-mono text-secondary-foreground transition-colors cursor-pointer"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Points editor */}
            {(type === "points" || type === "scatter") && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Data Points
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddPoint}
                    className="h-6 text-[10px] px-2"
                  >
                    + Add Point
                  </Button>
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {points.map((pt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        value={pt.x}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoints((prev) =>
                            prev.map((p, idx) => (idx === i ? { ...p, x: val } : p)),
                          );
                        }}
                        placeholder="X"
                        className="h-7 text-xs w-14 font-mono"
                      />
                      <Input
                        value={pt.y}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoints((prev) =>
                            prev.map((p, idx) => (idx === i ? { ...p, y: val } : p)),
                          );
                        }}
                        placeholder="Y"
                        className="h-7 text-xs w-14 font-mono"
                      />
                      <Input
                        value={pt.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPoints((prev) =>
                            prev.map((p, idx) => (idx === i ? { ...p, label: val } : p)),
                          );
                        }}
                        placeholder="Label"
                        className="h-7 text-xs flex-1"
                      />
                      {type === "points" && (
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={pt.connect}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPoints((prev) =>
                                prev.map((p, idx) => (idx === i ? { ...p, connect: checked } : p)),
                              );
                            }}
                            className="rounded"
                          />
                          Line
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemovePoint(i)}
                        className="text-destructive hover:opacity-80 px-1 text-xs cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coordinate Range Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Coordinate Range
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                <div>
                  <span className="text-[10px] text-muted-foreground">X Min</span>
                  <Input
                    type="number"
                    value={xMin}
                    onChange={(e) => setXMin(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">X Max</span>
                  <Input
                    type="number"
                    value={xMax}
                    onChange={(e) => setXMax(parseFloat(e.target.value) || 1)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Y Min</span>
                  <Input
                    type="number"
                    value={yMin}
                    onChange={(e) => setYMin(parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Y Max</span>
                  <Input
                    type="number"
                    value={yMax}
                    onChange={(e) => setYMax(parseFloat(e.target.value) || 1)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Title & Labels */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <span className="text-[10px] text-muted-foreground">Graph Title</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Parabola"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">X Label</span>
                <Input
                  value={xLabel}
                  onChange={(e) => setXLabel(e.target.value)}
                  placeholder="x"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Y Label</span>
                <Input
                  value={yLabel}
                  onChange={(e) => setYLabel(e.target.value)}
                  placeholder="y"
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Show Grid Lines</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={showAxisLabels}
                  onChange={(e) => setShowAxisLabels(e.target.checked)}
                  className="rounded text-primary"
                />
                <span>Show Numbers</span>
              </label>
            </div>
          </div>

          {/* Technical Preview Canvas Column */}
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 border border-slate-200">
            <canvas
              ref={canvasRef}
              className="w-full h-[220px] rounded-lg border border-slate-200 shadow-sm bg-white"
            />
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Technical preview (final page output will be rendered as natural handwriting strokes)
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleInsert}
            disabled={type === "function" && Boolean(expressionError)}
            className="h-8 text-xs font-semibold"
          >
            Insert Graph
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
