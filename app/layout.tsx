import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import AppClerkProvider from "@/components/app-clerk-provider";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
});

const body = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Дуугаа Таа — Монгол дуу таах тоглоом",
  description:
    "Монгол болон гадаад дууны богино хэсгийг сонсоод нэрийг нь таах тоглоом.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
