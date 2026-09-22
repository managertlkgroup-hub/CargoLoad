import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/app-toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";
// Inter self-hosted из public/fonts — @font-face c unicode-range см. в globals.css

export const metadata: Metadata = {
  title: "CargoPlanner — планировщик загрузки грузового транспорта",
  description:
    "Умное распределение груза в кузове: 2D/3D-раскладка, мульти-стоп, осевые нагрузки, LDM, центр тяжести и экспорт PDF/XLSX. Быстрее и красивее всех аналогов.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07050e" },
    { media: "(prefers-color-scheme: light)", color: "#f4f2fb" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <div className="aurora" aria-hidden />
            <div className="grain" aria-hidden />
            {children}
            <AppToaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
