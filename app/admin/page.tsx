import type { Metadata } from "next";
import AdminClient from "./AdminClient";
import "./admin.css";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
