import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://ayoub-shop-watches.splendidelderberry1.chatgpt.site",
  ),
  title: {
    default: "Ayoub Shop | Premium Watches & Accessories",
    template: "%s | Ayoub Shop",
  },
  description:
    "Make every moment yours. Discover contemporary premium watches at Ayoub Shop. Shop in MAD with cash on delivery across Morocco.",
  openGraph: {
    title: "Ayoub Shop | Your time. Your statement.",
    description:
      "Contemporary watches. Exceptional details. Delivered across Morocco.",
    type: "website",
    locale: "en_MA",
    siteName: "Ayoub Shop",
    images: [
      {
        url: "/images/watch-hero.webp",
        width: 1254,
        height: 1254,
        alt: "Ayoub Shop Eclipse Chronograph",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ayoub Shop | Premium Watches & Accessories",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const saved = (await cookies()).get("ayoub-language")?.value;
  const language = saved === "fr" || saved === "ar" ? saved : "en";
  return (
    <html
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
