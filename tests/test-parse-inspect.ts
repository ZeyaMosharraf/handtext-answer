import { unescapeHtml, plainSegments } from "../src/lib/handwriting/parse";

const tokenizedHtml = "\n\n                               ghghvgjh     \n\n";
const rawTrailing = tokenizedHtml.replace(/<[^>]+>/g, "");
if (rawTrailing.trim()) {
  const preserved = rawTrailing.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\n+|\n+$/g, "");
  console.log("PRESERVED:", JSON.stringify(preserved));
}
