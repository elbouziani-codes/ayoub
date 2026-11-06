import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/server/auth";
import { getRequestLocale } from "@/lib/seo";
import AdminClient from "./AdminClient";
import "./admin.css";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await adminSession();
  if (!session.isAdmin) redirect("/admin/login");
  return <AdminClient initialLanguage={await getRequestLocale()} />;
}
