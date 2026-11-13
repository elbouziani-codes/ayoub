import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { getStoreSettings, saveStoreSettings } from "@/lib/server/store-settings";

export async function GET() {
  try { await requireAdmin(); return json({ settings: await getStoreSettings() }); }
  catch (error) { return handleError(error); }
}
export async function PUT(request: Request) {
  try {
    requireSameOrigin(request); const session = await requireAdmin(); const settings = await saveStoreSettings(await readJson(request), session.user!.email);
    await audit(session.user!.email, "settings.update", "store_settings", "store", { business: settings.business, shipping: settings.shipping, appearance: settings.appearance, checkout: settings.checkout, defaultLocale: settings.defaultLocale });
    return json({ settings });
  } catch (error) { return handleError(error); }
}
