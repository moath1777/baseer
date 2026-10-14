import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();
const nextConfig: NextConfig = { devIndicators: false };
export default nextConfig;
