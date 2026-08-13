import type { Metadata } from "next";
import { inter, quicksand } from "@/lib/fonts";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/nav/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "XKT World Tour",
  description: "Tournaments, rankings and stats from the Tennis Elbow 4 Online Tour",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${inter.variable} font-sans h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
