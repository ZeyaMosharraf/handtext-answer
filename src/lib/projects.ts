import { supabase } from "@/integrations/supabase/client";
import { withDefaults, type HandwritingSettings } from "@/lib/handwriting";
import { planById } from "@/lib/plans";

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
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch as unknown as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Project not found or update permission denied");
  }
  return normalise(data);
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

export interface UserUsageInfo {
  planId: "free" | "pro" | "student";
  planName: string;
  monthlyPageLimit: number | null;
  pagesUsedThisMonth: number;
  pagesRemaining: number | null;
  totalProjectsCount: number;
}

export async function getUserUsage(): Promise<UserUsageInfo> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    const freePlan = planById("free");
    return {
      planId: "free",
      planName: freePlan.name,
      monthlyPageLimit: freePlan.monthlyPageLimit,
      pagesUsedThisMonth: 0,
      pagesRemaining: freePlan.monthlyPageLimit,
      totalProjectsCount: 0,
    };
  }

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
  const plan = planById(profile?.plan ?? "free");

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: usageRows } = await supabase
    .from("usage")
    .select("pages_generated, generation_date")
    .eq("user_id", userId)
    .gte("generation_date", firstDayOfMonth);

  const pagesUsedThisMonth = (usageRows ?? []).reduce(
    (sum, row) => sum + (row.pages_generated ?? 0),
    0,
  );

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const pagesRemaining =
    plan.monthlyPageLimit === null
      ? null
      : Math.max(0, plan.monthlyPageLimit - pagesUsedThisMonth);

  return {
    planId: plan.id,
    planName: plan.name,
    monthlyPageLimit: plan.monthlyPageLimit,
    pagesUsedThisMonth,
    pagesRemaining,
    totalProjectsCount: count ?? 0,
  };
}

export interface ProjectSnapshot {
  name: string;
  question: string;
  content: string;
  settings: HandwritingSettings;
  assignmentMode: boolean;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

export function isProjectSnapshotEqual(a: ProjectSnapshot, b: ProjectSnapshot): boolean {
  if (a.name.trim() !== b.name.trim()) return false;
  if (a.assignmentMode !== b.assignmentMode) return false;
  const qA = a.assignmentMode ? a.question.trim() : "";
  const qB = b.assignmentMode ? b.question.trim() : "";
  if (qA !== qB) return false;
  if (a.content.trim() !== b.content.trim()) return false;
  return deepEqual(a.settings, b.settings);
}
