import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock, FileText, Plus, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/SiteHeader";
import { Badge, Button, Card, Input, Label, Spinner } from "@/components/ui/primitives";
import { signOut, useAuth } from "@/hooks/useAuth";
import { DEFAULT_SETTINGS, HANDWRITING_STYLES } from "@/lib/handwriting";
import { createProject, deleteProject, listProjects } from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My projects — HandText" },
      { name: "description", content: "All your handwritten answer projects in one place." },
      { property: "og:title", content: "My projects — HandText" },
      { property: "og:description", content: "Open, create and manage your handwritten answer sheets." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: (name: string) =>
      createProject(name.trim() || "Untitled answer", DEFAULT_SETTINGS),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/editor/$projectId", params: { projectId: project.id } });
    },
    onError: () => toast.error("We couldn't create that project. Please try again."),
  });

  const remove = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted.");
    },
    onError: () => toast.error("We couldn't delete that project."),
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/settings">
              <Button variant="ghost" size="sm">
                <Settings className="size-4" /> Settings
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">My projects</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {user?.email ?? "your account"}
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create new handwritten answer
          </Button>
        </div>

        {creating && (
          <Card className="mt-6 max-w-lg space-y-3 p-5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              autoFocus
              placeholder="MCS-224 Assignment 2026"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create.mutate(newName)}
            />
            <div className="flex gap-2">
              <Button onClick={() => create.mutate(newName)} disabled={create.isPending}>
                {create.isPending && <Spinner />} Create and open editor
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        <div className="mt-8">
          {isLoading && <p className="text-sm text-muted-foreground">Loading your projects…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              We couldn't load your projects. Please refresh the page.
            </p>
          )}
          {projects && projects.length === 0 && !creating && (
            <Card className="flex flex-col items-center gap-3 p-12 text-center">
              <FileText className="size-6 text-primary" />
              <h2 className="text-lg font-semibold">No projects yet</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create your first project, paste an answer and generate handwritten pages.
              </p>
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Create new handwritten answer
              </Button>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((project) => {
              const styleName =
                HANDWRITING_STYLES.find((s) => s.id === project.settings.styleId)?.name ?? "Custom";
              return (
                <Card key={project.id} className="flex flex-col p-5">
                  <h2 className="truncate font-semibold">{project.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.page_count || 0} page{project.page_count === 1 ? "" : "s"} · {styleName}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" /> Updated {timeAgo(project.updated_at)}
                  </p>
                  <div className="mt-2">
                    <Badge>{project.status === "generated" ? "Generated" : "Draft"}</Badge>
                  </div>
                  <div className="mt-4 flex gap-2 pt-1">
                    <Link
                      to="/editor/$projectId"
                      params={{ projectId: project.id }}
                      className="flex-1"
                    >
                      <Button className="w-full" size="sm">
                        Open
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${project.name}`}
                      onClick={() => {
                        if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                          remove.mutate(project.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
