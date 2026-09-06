import type { Metadata } from "next";
import { inter } from "@/lib/fonts";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TE4 XKT Tour",
  description: "Tournaments, rankings and stats from the Tennis Elbow 4 Online Tour",
  icons: {
    icon: "/assets/webicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        <Providers>
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
