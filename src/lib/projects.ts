import { supabase } from "@/integrations/supabase/client";
import { withDefaults, type HandwritingSettings } from "@/lib/handwriting";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  question: string;
  content: string;
  settings: HandwritingSettings;
  page_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

function normalise(row: Record<string, unknown>): Project {
  return {
    ...(row as unknown as Project),
    settings: withDefaults(row["settings"] as Partial<HandwritingSettings>),
  };
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalise);
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error) throw error;
  return normalise(data);
}

export async function createProject(name: string, settings: HandwritingSettings) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("You need to be signed in.");
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, user_id: userId, settings: settings as unknown as never })
    .select("*")
    .single();
  if (error) throw error;
  return normalise(data);
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "question" | "content" | "page_count" | "status">> & {
    settings?: HandwritingSettings;
  },
) {
  const { error } = await supabase
    .from("projects")
    .update(patch as unknown as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function recordUsage(pages: number) {
  if (!Number.isInteger(pages) || pages < 1) return;
  // Usage counters are incremented server-side so clients cannot rewrite them.
  const { error } = await supabase.rpc("record_usage" as never, {
    p_pages: pages,
  } as never);
  if (error) throw error;
}

export async function getProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}
