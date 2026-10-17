import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bg"><body><AppShell>{children}</AppShell></body></html>;
}
