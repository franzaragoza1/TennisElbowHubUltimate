import type { Metadata } from "next";
import { interExtended, interLatin } from "@/lib/fonts";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/nav/SiteFooter";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { MatchLogReminderToast } from "@/components/account/MatchLogReminderToast";
import { PushSubscriptionManager } from "@/components/push/PushSubscriptionManager";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "TE4 XKT Tour",
  description: "Tournaments, rankings and stats from the Tennis Elbow 4 Online Tour",
  // Iconos a su tamaño real (pase de rendimiento, 2026-10-11): antes era el PNG original
  // de 1040 px (706 KB) en cada página. `public/assets/webicon.png` se queda como fuente.
  icons: {
    icon: [
      { url: "/assets/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/assets/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${interLatin.variable} ${interExtended.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript />
        <Providers>
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <MatchLogReminderToast />
          <PushSubscriptionManager />
        </Providers>
      </body>
    </html>
  );
}
