import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import "./readability.css";

export const metadata: Metadata = {
  title: "بصير | إدارة الأداء المؤسسي",
  description:
    "نموذج تفاعلي لإدارة الاستراتيجية والمؤشرات ودورات القياس في نظام بصير.",
  robots: { index: false, follow: false },
  icons: { icon: "/mngdp-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
