import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/seo";
import AdminLoginClient from "../AdminLoginClient";
import "../admin.css";

export const metadata: Metadata = {
  title: "Administrator sign in",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  return <AdminLoginClient initialLanguage={await getRequestLocale()} />;
}
