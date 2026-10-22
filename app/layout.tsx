import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PwaSetup from "@/components/PwaSetup";

export const metadata: Metadata = {
  title: "NutriX Glucose",
  description: "Snap, type or say a meal and see how it affects your glucose.",
  appleWebApp: { capable: true, title: "NutriX", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4338ca" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f17" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <PwaSetup />
        {children}
        <footer className="foot">NutriX Glucose · pilot prototype · not medical advice · portions and nutrition are estimates</footer>
      </body>
    </html>
  );
}
