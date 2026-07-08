import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";
import SyncIndicator from "../components/SyncIndicator";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "EquusCronos - Tiempos y Resultados en Vivo",
  description:
    "Portal público de clasificaciones de EquusCronos. Sigue los tiempos oficiales de eventos de Raid Hípico y Endurance de la FEU en tiempo real.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-equus-bg text-equus-text font-sans">
        <Providers>
          {/* Header oficial con Branding de Alta Coherencia */}
          <header className="bg-equus-green text-white shadow-md sticky top-0 z-50 border-b border-equus-tan-light/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-center border border-slate-100/10">
                  <img
                    src="/ECLogo Leyenda.png"
                    alt="EquusCronos Logo Oficial"
                    className="h-10 w-auto object-contain"
                  />
                </div>
                <div className="h-6 w-px bg-white/20"></div>
                <span className="text-sm font-extrabold tracking-widest uppercase text-[#A99677] font-sans">
                  PORTAL DE RESULTADOS EN VIVO
                </span>
              </div>
              <SyncIndicator />
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
