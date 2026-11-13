import { legalPageSlugs } from "@/lib/legal";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { getLegalAdminState, publishLegalDraft, restoreLegalVersion, saveLegalDraft } from "@/lib/server/legal";
import { handleError, json, readJson, requireSameOrigin } from "@/lib/server/http";
import { z } from "zod";

export async function GET() {
  try { await requireAdmin(); return json({ pages: await getLegalAdminState() }); }
  catch (error) { return handleError(error); }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request); const session = await requireAdmin(); const input = await readJson(request);
    const version = await saveLegalDraft(input, session.user!.email);
    await audit(session.user!.email, "legal.draft.save", "legal_page", version.slug, { version: version.version });
    return json({ version });
  } catch (error) { return handleError(error); }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), slug: z.enum(legalPageSlugs) }),
  z.object({ action: z.literal("restore"), slug: z.enum(legalPageSlugs), versionId: z.string().uuid() }),
]);
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const session = await requireAdmin(); const input = actionSchema.parse(await readJson(request));
    const version = input.action === "publish" ? await publishLegalDraft(input.slug, session.user!.email)
      : await restoreLegalVersion(input.slug, input.versionId, session.user!.email);
    await audit(session.user!.email, `legal.${input.action}`, "legal_page", input.slug, { version: version.version, sourceVersionId: "versionId" in input ? input.versionId : undefined });
    return json({ version });
  } catch (error) { return handleError(error); }
}
