import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env
try {
  const envContent = readFileSync(".env", "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key && rest.length > 0) {
      const val = rest.join("=").replace(/^["']|["']$/g, "");
      process.env[key.trim()] = val;
    }
  }
} catch (e) {
  console.warn("Could not read .env:", e);
}

const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
const supabaseKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || "";

console.log("Supabase URL:", supabaseUrl);
console.log("Key format valid:", supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("ey"));

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Testing basic PostgREST query...");
  const t0 = performance.now();
  const { data, error } = await supabase.from("projects").select("id").limit(1);
  const t1 = performance.now();
  console.log(`Query completed in ${(t1 - t0).toFixed(2)}ms`);
  console.log("Data:", data);
  console.log("Error (expected if unauthenticated due to RLS):", error?.message ?? "none");
}

main().catch(console.error);
