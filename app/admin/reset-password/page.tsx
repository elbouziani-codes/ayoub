import type { Metadata } from "next";
import { getRequestLocale } from "@/lib/seo";
import AdminResetPasswordClient from "../AdminResetPasswordClient";
import "../admin.css";
import "../recovery.css";

export const metadata: Metadata = {
  title: "Reset administrator password",
  robots: { index: false, follow: false },
};

export default async function AdminResetPasswordPage() {
  return <AdminResetPasswordClient initialLanguage={await getRequestLocale()} />;
}
