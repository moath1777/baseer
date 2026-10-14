import Link from "next/link";
import { Workspace } from "@/components/workspace";
import { WorkspaceProvider } from "@/components/workspace-provider";
export default function PreviewPage() {
  return (
    <WorkspaceProvider>
      <div className="f-notice" style={{ margin: 0, borderRadius: 0 }}>
        <span>
          نموذج M1 ببيانات تجريبية محلية · M1 preview with local demonstration
          data
        </span>
        <Link href="/overview">مساحة العمل الفعلية / Live workspace</Link>
      </div>
      <Workspace />
    </WorkspaceProvider>
  );
}
