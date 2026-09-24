import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env
const envContent = readFileSync(".env", "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  if (key && rest.length > 0) {
    process.env[key.trim()] = rest.join("=").replace(/^["']|["']$/g, "");
  }
}

const supabaseUrl = process.env["VITE_SUPABASE_URL"] || "";
const supabaseKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuth() {
  console.log("Attempting anonymous sign in...");
  const anonRes = await supabase.auth.signInAnonymously();
  console.log("Anonymous sign in result:", {
    userId: anonRes.data.user?.id,
    session: Boolean(anonRes.data.session),
    error: anonRes.error?.message,
  });
}

checkAuth().catch(console.error);
