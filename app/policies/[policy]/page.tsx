import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { localizedDictionary, type TranslationKey } from "@/lib/i18n";
import { getRequestLocale, pageMetadata } from "@/lib/seo";
import { getContentOverrides } from "@/lib/server/content";
export const dynamic = "force-dynamic";
const policies = ["terms", "privacy", "shipping"] as const;
const isPolicy = (policy: string): policy is typeof policies[number] => policies.some((value) => value === policy);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>;
}): Promise<Metadata> {
  const { policy } = await params;
  const locale = await getRequestLocale();
  if (!isPolicy(policy)) return { title: "Page not found", robots: { index: false, follow: true } };
  const d = localizedDictionary(locale, await getContentOverrides());
  return pageMetadata({ locale, title: d[policy], description: d[`${policy}Policy`], path: `/policies/${policy}` });
}
export default async function Policy({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  if (!isPolicy(policy)) notFound();
  const lang = await getRequestLocale();
  const d = localizedDictionary(lang, await getContentOverrides());
  return (
    <main
      className="container"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ maxWidth: 760, paddingTop: 70, paddingBottom: 100 }}
    >
      <Link className="text-link" href="/" prefetch={false}>
        ← AYOUB SHOP
      </Link>
      <h1 style={{ fontSize: 38, margin: "35px 0" }}>
        {d[policy as TranslationKey]}
      </h1>
      <p className="policy-copy">{d[`${policy}Policy` as TranslationKey]}</p>
    </main>
  );
}
