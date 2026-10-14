import { notFound, redirect } from "next/navigation";
import { FoundationWorkspace } from "@/components/foundation-workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  const sections = [
    "overview",
    "strategy",
    "indicators",
    "measurements",
    "approvals",
    "settings",
    "tasks",
    "reports",
  ];
  if (
    path.length > 2 ||
    (path[0] && !sections.includes(path[0])) ||
    (path.length === 2 && path[0] !== "indicators")
  )
    notFound();
  if (["indicators", "measurements", "approvals"].includes(path[0])) redirect("/tasks");
  return <FoundationWorkspace />;
}
