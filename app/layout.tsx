import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import Topbar from "@/components/Topbar";
import Toast from "@/components/Toast";
import { THEME_BOOT } from "@/lib/themeBoot";
import "./globals.css";

const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["500", "600", "700", "800"], style: ["normal", "italic"], variable: "--font-prompt", display: "swap" });
const plex = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: "QUIZVERSE",
  description: "เว็บแอปเกมตอบคำถามส่งเสริมการเรียนรู้ด้วย AI — Learn • Play • Challenge • Grow",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${prompt.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        {/* apply the saved light/dark choice before first paint (no flash) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Topbar />
        <main className="wrap">{children}</main>
        <Toast />
      </body>
    </html>
  );
}
