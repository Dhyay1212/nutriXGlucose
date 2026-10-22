import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "NutriX Glucose",
  description: "Snap an Indian meal, see how it affects your glucose.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
        <footer className="foot">NutriX Glucose · pilot prototype · not medical advice · portions and nutrition are estimates</footer>
      </body>
    </html>
  );
}
