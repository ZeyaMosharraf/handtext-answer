import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { Button, Card } from "@/components/ui/primitives";
import { getProject } from "@/lib/projects";

export const Route = createFileRoute("/_authenticated/editor/$projectId")({
  head: () => ({
    meta: [
      { title: "Editor — HandText" },
      { name: "description", content: "Write your answer, choose a handwriting style and generate handwritten pages." },
      { property: "og:title", content: "Editor — HandText" },
      { property: "og:description", content: "Convert your typed answer into handwritten pages." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading, isError } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    staleTime: 30000,
    retry: 3,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your project…
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-sm p-8 text-center">
          <h1 className="text-lg font-semibold">We couldn't open this project</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted, or it belongs to another account.
          </p>
          <Link to="/dashboard" className="mt-5 inline-block">
            <Button>Back to my projects</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return <EditorWorkspace project={project} />;
}
