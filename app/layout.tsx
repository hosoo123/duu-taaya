import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Дуугаа Таа — Монгол дуу таах тоглоом",
  description: "Монгол болон гадаад дууны богино хэсгийг сонсоод нэрийг нь таах тоглоом.",
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
    <html lang="mn">
      <body className="antialiased">{children}</body>
    </html>
  );
}
