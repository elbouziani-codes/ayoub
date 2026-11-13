import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/seo";
import SupportClient from "./support-client";
export const metadata: Metadata = { title: "Contact, complaints and returns" };
export default async function SupportPage() { const locale = await getRequestLocale(); return <SupportClient locale={locale} />; }
