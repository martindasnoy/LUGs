import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cubano = localFont({
  src: "../Imagenes/Cubano Regular.ttf",
  variable: "--font-cubano",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LUGs App",
  description: "Comunidad para LUGs y AFOLs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cubano.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
