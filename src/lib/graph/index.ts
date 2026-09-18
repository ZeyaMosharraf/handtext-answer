/**
 * src/lib/graph/index.ts
 *
 * Public entrypoint for the handwritten graph subsystem.
 */

export { layoutGraph, GRAPH_PADDING_TOP, GRAPH_PADDING_BOTTOM, GRAPH_PADDING_LEFT, GRAPH_PADDING_RIGHT, DEFAULT_GRAPH_AREA_WIDTH, DEFAULT_GRAPH_AREA_HEIGHT } from "./layout";
export { drawGraph } from "./renderer";
export { compileExpression } from "./parser";
export { makeCoordTransform, computeTickSpec, sampleFunction, segmentizeSamples, formatTickLabel, clipToRange } from "./geometry";
export { GraphParseError } from "./types";
export type {
  GraphType,
  GraphFunctionDef,
  GraphPointDef,
  GraphAnnotation,
  GraphCoordinateSpace,
  GraphDefinition,
  CoordTransform,
  TickSpec,
  SamplePoint,
  PolylineSegment,
  GraphLayoutBox,
} from "./types";
