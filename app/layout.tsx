import type { Metadata } from "next";
import { getRequestLocale, pageMetadata, SEO_COPY } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/shop-config";
import "./globals.css";
import "./upgrade.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const copy = SEO_COPY[locale];
  return {
    ...pageMetadata({ locale, title: copy.title, description: copy.description, path: "/" }),
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: { default: copy.title, template: `%s | ${SITE_NAME}` },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getRequestLocale();
  return (
    <html
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <head>
        <link rel="preload" href="/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {language === "ar" && <link rel="preload" href="/fonts/noto-sans-arabic-arabic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />}
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
