import { dictionaries } from "@/lib/i18n";
import { requireAdmin } from "@/lib/server/auth";
import { contentAssetSchema, contentInputSchema, getContentOverrides, getEditorialAsset, saveContent, saveEditorialAsset } from "@/lib/server/content";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";

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
    await requireAdmin();
    const body = await readJson(request) as { type?: string };
    if (body.type === "image") return json({ asset: await saveEditorialAsset(contentAssetSchema.parse(body)) });
    return json({ content: await saveContent(contentInputSchema.parse(body)) });
  } catch (error) { return handleError(error); }
}
