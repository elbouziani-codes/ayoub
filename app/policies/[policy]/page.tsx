import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { dictionaries, type TranslationKey } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>;
}): Promise<Metadata> {
  const { policy } = await params;
  return {
    title:
      policy === "privacy"
        ? "Privacy policy"
        : policy === "terms"
          ? "Terms & conditions"
          : "Shipping & delivery",
  };
}
export default async function Policy({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  if (!["terms", "privacy", "shipping"].includes(policy)) notFound();
  const saved = (await cookies()).get("ayoub-language")?.value;
  const lang = saved === "fr" || saved === "ar" ? saved : "en";
  const d = dictionaries[lang];
  return (
    <main
      className="container"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ maxWidth: 760, paddingTop: 70, paddingBottom: 100 }}
    >
      <a className="text-link" href="/">
        ← AYOUB SHOP
      </a>
      <h1 style={{ fontSize: 38, margin: "35px 0" }}>
        {d[policy as TranslationKey]}
      </h1>
      <p className="policy-copy">{d[`${policy}Policy` as TranslationKey]}</p>
    </main>
  );
}
