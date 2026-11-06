import Storefront from "@/components/storefront";
import { listProducts } from "@/lib/server/catalog";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default async function Home() {
  const saved = (await cookies()).get("ayoub-language")?.value;
  const locale: Locale = saved === "fr" || saved === "ar" ? saved : "en";
  try {
    return (
      <Storefront
        initialProducts={await listProducts()}
        initialLocale={locale}
      />
    );
  } catch {
    return (
      <Storefront
        initialProducts={[]}
        catalogUnavailable
        initialLocale={locale}
      />
    );
  }
}
