import { dictionaries } from "@/lib/i18n";
import { requireAdmin } from "@/lib/server/auth";
import { contentAssetSchema, contentInputSchema, getContentOverrides, getEditorialAsset, saveContent, saveEditorialAsset } from "@/lib/server/content";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function GET() {
  try {
    await requireAdmin();
    const [overrides, editorialAsset] = await Promise.all([getContentOverrides(), getEditorialAsset()]);
    return json({ defaults: dictionaries, overrides, editorialAsset });
  } catch (error) { return handleError(error); }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    const session = await requireAdmin();
    const body = await readJson(request) as { type?: string };
    if (body.type === "image") { const asset = await saveEditorialAsset(contentAssetSchema.parse(body)); await audit(session.user!.email, "content.asset.update", "content_asset", asset.slot, asset); return json({ asset }); }
    const content = await saveContent(contentInputSchema.parse(body)); await audit(session.user!.email, "content.update", "content", content.key, content); return json({ content });
  } catch (error) { return handleError(error); }
}
