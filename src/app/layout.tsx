import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "./globals.css";
import "./readability.css";
import "./management.css";
import "./foundation.css";

export const metadata: Metadata = {
  title: "بصير | إدارة الأداء المؤسسي",
  description:
    "بصير لإدارة الاستراتيجية والهيكل التنظيمي والأداء المؤسسي.",
  robots: { index: false, follow: false },
  icons: { icon: "/mngdp-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
