import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "TimeTrack - Sistema de Ponto",
  description: "Sistema profissional de gestão de ponto e horas de trabalho",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-gradient-to-br from-blue-950/95 via-slate-900/98 to-neutral-950 text-white font-sans">
        {/* Background grid */}
        <div className="fixed inset-0 bg-grid pointer-events-none opacity-40 z-0" />

        {/* Top accent bar */}
        <div className="fixed top-0 left-0 right-0 h-1 flex z-50">
          <div className="flex-1 bg-blue-600 animate-pulse-bar" />
          <div className="w-12 bg-white/20 animate-ping-slow absolute left-1/2 -translate-x-1/2 h-1" />
          <div className="flex-1 bg-red-600 animate-pulse-bar" style={{ animationDelay: '0.5s' }} />
        </div>

        <div className="relative z-10 flex min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:ml-0">
            <div className="p-4 lg:p-8 pt-6 lg:pt-10">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
