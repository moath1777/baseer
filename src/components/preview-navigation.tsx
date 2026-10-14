"use client";
import NextLink from "next/link";
import {
  usePathname as nextPathname,
  useRouter as nextRouter,
} from "next/navigation";
import type { ComponentProps } from "react";
export default function Link(props: ComponentProps<typeof NextLink>) {
  const href =
    typeof props.href === "string" && props.href.startsWith("/")
      ? `/preview${props.href}`
      : props.href;
  return <NextLink {...props} href={href} />;
}
export function usePathname() {
  return nextPathname().replace(/^\/preview(?=\/|$)/, "") || "/overview";
}
export function useRouter() {
  const router = nextRouter();
  return { ...router, push: (url: string) => router.push(`/preview${url}`) };
}
