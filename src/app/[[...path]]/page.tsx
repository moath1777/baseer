import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";

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
  ];
  if (
    path.length > 2 ||
    (path[0] && !sections.includes(path[0])) ||
    (path.length === 2 && path[0] !== "indicators")
  )
    notFound();
  return <Workspace />;
}
