import type { Metadata } from "next";
import { Manrope, Unbounded } from "next/font/google";
import AppClerkProvider from "@/components/app-clerk-provider";
import "./globals.css";

const SITE_URL = "https://duutaay.xyz";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Дуугаа Таа — Монгол дуу таах тоглоом",
    template: "%s · Дуугаа Таа",
  },
  description:
    "Монгол болон гадаад дууны богино хэсгийг сонсоод нэрийг нь таах тоглоом. Anime OP, hip-hop, pop — найзтайгаа party mode-оор тогло.",
  keywords: [
    "дуу таах",
    "монгол дуу",
    "дуугаа таа",
    "duutaay",
    "duu taa",
    "duutaa",
    "mongol duu",
    "song guess mongolia",
    "song quiz",
    "anime opening",
    "music game",
  ],
  authors: [{ name: "Дуугаа Таа" }],
  creator: "Дуугаа Таа",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: SITE_URL,
    siteName: "Дуугаа Таа",
    title: "Дуугаа Таа — Монгол дуу таах тоглоом",
    description:
      "Монгол болон гадаад дууны богино хэсгийг сонсоод нэрийг нь таах тоглоом.",
    images: [
      {
        url: "/duu-taaya-thumbnail.png",
        width: 1200,
        height: 630,
        alt: "Дуугаа Таа — дуу таах тоглоом",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Дуугаа Таа — Монгол дуу таах тоглоом",
    description:
      "Монгол болон гадаад дууны богино хэсгийг сонсоод нэрийг нь таах тоглоом.",
    images: ["/duu-taaya-thumbnail.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Дуугаа Таа",
  alternateName: ["Duugaa Taaya", "duutaay", "Duu Taaya"],
  url: SITE_URL,
  description:
    "Монгол болон гадаад дууны богино хэсгийг сонсоод нэрийг нь таах тоглоом.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  inLanguage: "mn",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  image: `${SITE_URL}/duu-taaya-thumbnail.png`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AppClerkProvider>{children}</AppClerkProvider>
      </body>
    </html>
  );
}
