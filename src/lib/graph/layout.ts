/**
 * src/lib/graph/layout.ts
 *
 * Graph layout engine.
 * Computes bounding boxes and lineUnits quantization for atomic pagination.
 */

import type { GraphDefinition, GraphLayoutBox } from "./types";
import { drawGraph } from "./renderer";

export const GRAPH_PADDING_TOP = 10;
export const GRAPH_PADDING_BOTTOM = 20;
export const GRAPH_PADDING_LEFT = 40;
export const GRAPH_PADDING_RIGHT = 20;
export const DEFAULT_GRAPH_AREA_WIDTH = 700;
export const DEFAULT_GRAPH_AREA_HEIGHT = 420;

/**
 * Compute layout metrics for a graph definition and return a GraphLayoutBox.
 *
 * @param definition    The graph definition
 * @param rulingSpacing Document line ruling spacing in pixels
 */
export function layoutGraph(
  definition: GraphDefinition,
  rulingSpacing: number,
): GraphLayoutBox {
  const safeRuling = Math.max(1, rulingSpacing);
  const titleHeight = definition.title ? Math.ceil(safeRuling * 1.2) : 0;
  const xLabelHeight = definition.xLabel ? 28 : 0;
  const yLabelWidth = definition.yLabel ? 28 : 0;

  const graphAreaWidth = definition.widthHint ?? DEFAULT_GRAPH_AREA_WIDTH;
  const graphAreaHeight = definition.heightHint ?? DEFAULT_GRAPH_AREA_HEIGHT;

  const totalWidth = yLabelWidth + GRAPH_PADDING_LEFT + graphAreaWidth + GRAPH_PADDING_RIGHT;
  const totalHeight =
    GRAPH_PADDING_TOP + titleHeight + graphAreaHeight + xLabelHeight + GRAPH_PADDING_BOTTOM;

  const lineUnits = Math.max(1, Math.ceil(totalHeight / safeRuling));

  const graphArea = {
    left: yLabelWidth + GRAPH_PADDING_LEFT,
    top: GRAPH_PADDING_TOP + titleHeight,
    width: graphAreaWidth,
    height: graphAreaHeight,
  };

  const box: GraphLayoutBox = {
    width: totalWidth,
    height: totalHeight,
    lineUnits,
    graphArea,
    draw(ctx, originX, topY, settings, random, ink) {
      drawGraph(ctx, definition, box, originX, topY, settings, random, ink);
    },
    definition,
  };

  return box;
}
