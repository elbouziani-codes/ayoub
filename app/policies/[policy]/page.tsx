import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LegalDocument from "@/components/legal-document";
import { legalPageLabels, legalPageSlugs, type LegalPageSlug } from "@/lib/legal";
import { getRequestLocale, pageMetadata } from "@/lib/seo";
import { getPublishedLegalPage } from "@/lib/server/legal";
export const dynamic = "force-dynamic";
const isPolicy = (policy: string): policy is LegalPageSlug => legalPageSlugs.some((value) => value === policy);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ policy: string }>;
}): Promise<Metadata> {
  const { policy } = await params;
  const locale = await getRequestLocale();
  if (!isPolicy(policy)) return { title: "Page not found", robots: { index: false, follow: true } };
  return pageMetadata({ locale, title: legalPageLabels[policy][locale], description: legalPageLabels[policy][locale], path: `/policies/${policy}` });
}
export default async function Policy({
  params,
}: {
  params: Promise<{ policy: string }>;
}) {
  const { policy } = await params;
  if (!isPolicy(policy)) notFound();
  const lang = await getRequestLocale();
  const version = await getPublishedLegalPage(policy);
  return (
    <main className="legal-page" dir={lang === "ar" ? "rtl" : "ltr"}>
      <nav className="legal-nav" aria-label={lang === "ar" ? "الصفحات القانونية" : lang === "fr" ? "Pages juridiques" : "Legal pages"}>
        <Link href="/" className="legal-brand">AYOUB <span>SHOP</span></Link>
        <div>{legalPageSlugs.map((slug) => <Link key={slug} className={slug === policy ? "active" : ""} href={`/policies/${slug}`}>{legalPageLabels[slug][lang]}</Link>)}</div>
      </nav>
      {version ? <LegalDocument document={version.documents[lang]} version={version.version} publishedAt={version.publishedAt} /> : <section className="legal-unpublished">
        <span>{lang === "ar" ? "بانتظار التحقق" : lang === "fr" ? "Vérification requise" : "Verification required"}</span>
        <h1>{legalPageLabels[policy][lang]}</h1>
        <p>{lang === "ar" ? "لم تُنشر هذه الوثيقة بعد. يجب على مسؤول المتجر إدخال البيانات التجارية الموثقة ومراجعة المحتوى قبل النشر." : lang === "fr" ? "Ce document n’est pas encore publié. L’administrateur doit renseigner les informations vérifiées de l’entreprise et valider son contenu avant publication." : "This document has not been published. The administrator must provide verified business details and review it before publication."}</p>
        <Link href="/">← Ayoub Shop</Link>
      </section>}
    </main>
  );
}
