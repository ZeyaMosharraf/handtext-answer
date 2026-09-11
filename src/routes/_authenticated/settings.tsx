import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card, Input, Label, Select } from "@/components/ui/primitives";
import { signOut, useAuth } from "@/hooks/useAuth";
import { HANDWRITING_STYLES, PAPERS } from "@/lib/handwriting";
import { planById } from "@/lib/plans";
import { getProfile, listProjects } from "@/lib/projects";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HandText" },
      { name: "description", content: "Manage your profile, handwriting defaults, plan and account." },
      { property: "og:title", content: "Settings — HandText" },
      { property: "og:description", content: "Profile, preferences and account settings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("natural");
  const [defaultInk, setDefaultInk] = useState("blue");
  const [defaultPage, setDefaultPage] = useState("ruled");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
    setDefaultStyle(profile.default_style ?? "natural");
    setDefaultInk(profile.default_ink ?? "blue");
    setDefaultPage(profile.default_page ?? "ruled");
  }, [profile]);

  const plan = planById(profile?.plan ?? "free");
  const pagesGenerated = (projects ?? []).reduce((sum, p) => sum + (p.page_count ?? 0), 0);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        default_style: defaultStyle,
        default_ink: defaultInk,
        default_page: defaultPage,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("We couldn't save your settings. Please try again.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Settings saved.");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="size-4" /> Back to my projects
        </Button>
      </Link>
      <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>

      <Card className="mt-6 space-y-4 p-6">
        <h2 className="font-semibold">Profile</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-14 rounded-full object-cover" />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
              {(fullName || user?.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="avatar">Profile picture URL</Label>
            <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullname">Name</Label>
          <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user?.email ?? ""} readOnly className="bg-muted" />
        </div>
      </Card>

      <Card className="mt-5 space-y-4 p-6">
        <h2 className="font-semibold">Preferences</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="style">Default handwriting</Label>
            <Select id="style" value={defaultStyle} onChange={(e) => setDefaultStyle(e.target.value)}>
              {HANDWRITING_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ink">Default ink</Label>
            <Select id="ink" value={defaultInk} onChange={(e) => setDefaultInk(e.target.value)}>
              <option value="blue">Blue</option>
              <option value="darkblue">Dark blue</option>
              <option value="black">Black</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="page">Default page</Label>
            <Select id="page" value={defaultPage} onChange={(e) => setDefaultPage(e.target.value)}>
              {PAPERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </Card>

      <Card className="mt-5 space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Account</h2>
          <Badge>{plan.name} plan</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {projects?.length ?? 0} project{projects?.length === 1 ? "" : "s"} · {pagesGenerated} pages generated
          {plan.monthlyPageLimit ? ` of ${plan.monthlyPageLimit} included each month` : " · unlimited pages"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/pricing">
            <Button variant="outline">View plans</Button>
          </Link>
          <Button
            variant="ghost"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            Log out
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              toast("Deleting your account", {
                description:
                  "For your safety this needs a confirmation from us. Email support and we'll remove your account and all pages within 24 hours.",
              })
            }
          >
            Delete account
          </Button>
        </div>
      </Card>
    </div>
  );
}
