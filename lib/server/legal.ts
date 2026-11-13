import { z } from "zod";
import { initialLegalDocument, legalPageSlugs, type LegalPageSlug, type LegalVersion, type Locale } from "../legal";
import { getDatabase } from "./db";
import { HttpError } from "./http";
import { getStoreSettings } from "./store-settings";

const sectionSchema = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/), heading: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20_000) });
const documentSchema = z.object({ title: z.string().trim().min(2).max(240), sections: z.array(sectionSchema).min(1).max(30) });
export const legalDraftSchema = z.object({ slug: z.enum(legalPageSlugs), documents: z.object({ en: documentSchema, fr: documentSchema, ar: documentSchema }) })
  .superRefine((value, ctx) => {
    const ids = value.documents.en.sections.map((section) => section.id).join("|");
    for (const locale of ["fr", "ar"] as const) if (value.documents[locale].sections.map((section) => section.id).join("|") !== ids) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documents", locale, "sections"], message: "All languages must contain the same ordered sections" });
    }
  });

type VersionRow = { id: string; page_slug: LegalPageSlug; version: number; title_en: string; title_fr: string; title_ar: string;
  sections_en: string; sections_fr: string; sections_ar: string; status: LegalVersion["status"]; created_by: string; created_at: string; published_at: string | null };
type PageRow = { slug: LegalPageSlug; draft_version_id: string | null; published_version_id: string | null; updated_at: string };

function mapVersion(row: VersionRow): LegalVersion {
  const document = (locale: Locale) => ({ title: row[`title_${locale}`], sections: JSON.parse(row[`sections_${locale}`]) });
  return { id: row.id, slug: row.page_slug, version: Number(row.version), status: row.status,
    documents: { en: document("en"), fr: document("fr"), ar: document("ar") }, createdBy: row.created_by,
    createdAt: row.created_at, publishedAt: row.published_at };
}

async function ensurePage(slug: LegalPageSlug) {
  const db = getDatabase();
  const existing = await db.prepare("SELECT slug FROM legal_pages WHERE slug = ?").bind(slug).first();
  if (existing) return;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const documents = { en: initialLegalDocument(slug, "en"), fr: initialLegalDocument(slug, "fr"), ar: initialLegalDocument(slug, "ar") };
  try {
    await db.batch([
      db.prepare("INSERT INTO legal_pages (slug, draft_version_id, published_version_id, updated_at) VALUES (?, ?, NULL, ?)").bind(slug, id, now),
      db.prepare(`INSERT INTO legal_page_versions (id, page_slug, version, title_en, title_fr, title_ar, sections_en, sections_fr, sections_ar,
        status, created_by, created_at, published_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 'draft', 'system', ?, NULL)`)
        .bind(id, slug, documents.en.title, documents.fr.title, documents.ar.title, JSON.stringify(documents.en.sections),
          JSON.stringify(documents.fr.sections), JSON.stringify(documents.ar.sections), now),
    ]);
  } catch (error) {
    const raced = await db.prepare("SELECT slug FROM legal_pages WHERE slug = ?").bind(slug).first();
    if (!raced) throw error;
  }
}

async function pageRow(slug: LegalPageSlug): Promise<PageRow> {
  await ensurePage(slug);
  return (await getDatabase().prepare("SELECT * FROM legal_pages WHERE slug = ?").bind(slug).first<PageRow>())!;
}

async function versionById(id: string): Promise<LegalVersion | null> {
  const row = await getDatabase().prepare("SELECT * FROM legal_page_versions WHERE id = ?").bind(id).first<VersionRow>();
  return row ? mapVersion(row) : null;
}

export async function getPublishedLegalPage(slug: LegalPageSlug): Promise<LegalVersion | null> {
  const page = await pageRow(slug);
  return page.published_version_id ? versionById(page.published_version_id) : null;
}

export async function getLegalAdminState() {
  await Promise.all(legalPageSlugs.map(ensurePage));
  const pages = await getDatabase().prepare("SELECT * FROM legal_pages ORDER BY slug").all<PageRow>();
  const result = [];
  for (const page of pages.results) {
    const history = await getDatabase().prepare("SELECT * FROM legal_page_versions WHERE page_slug = ? ORDER BY version DESC").bind(page.slug).all<VersionRow>();
    result.push({ slug: page.slug, draft: page.draft_version_id ? await versionById(page.draft_version_id) : null,
      published: page.published_version_id ? await versionById(page.published_version_id) : null, history: history.results.map(mapVersion) });
  }
  return result;
}

export async function saveLegalDraft(input: unknown, adminEmail: string): Promise<LegalVersion> {
  const value = legalDraftSchema.parse(input);
  const page = await pageRow(value.slug);
  const db = getDatabase();
  const d = value.documents;
  const now = new Date().toISOString();
  if (page.draft_version_id) {
    const current = await versionById(page.draft_version_id);
    if (!current || current.status !== "draft") throw new HttpError(409, "The legal draft changed. Refresh and try again.", "draft_changed");
    await db.prepare(`UPDATE legal_page_versions SET title_en = ?, title_fr = ?, title_ar = ?, sections_en = ?, sections_fr = ?, sections_ar = ?, created_by = ?, created_at = ?
      WHERE id = ? AND status = 'draft'`).bind(d.en.title, d.fr.title, d.ar.title, JSON.stringify(d.en.sections), JSON.stringify(d.fr.sections), JSON.stringify(d.ar.sections), adminEmail, now, current.id).run();
    return (await versionById(current.id))!;
  }
  const max = await db.prepare("SELECT MAX(version) AS value FROM legal_page_versions WHERE page_slug = ?").bind(value.slug).first<{ value: number | null }>();
  const id = crypto.randomUUID();
  const version = Number(max?.value ?? 0) + 1;
  await db.batch([
    db.prepare(`INSERT INTO legal_page_versions (id, page_slug, version, title_en, title_fr, title_ar, sections_en, sections_fr, sections_ar, status, created_by, created_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL)`).bind(id, value.slug, version, d.en.title, d.fr.title, d.ar.title, JSON.stringify(d.en.sections), JSON.stringify(d.fr.sections), JSON.stringify(d.ar.sections), adminEmail, now),
    db.prepare("UPDATE legal_pages SET draft_version_id = ?, updated_at = ? WHERE slug = ? AND draft_version_id IS NULL").bind(id, now, value.slug),
  ]);
  return (await versionById(id))!;
}

export async function publishLegalDraft(slug: LegalPageSlug, adminEmail: string): Promise<LegalVersion> {
  const page = await pageRow(slug);
  if (!page.draft_version_id) throw new HttpError(409, "Save a complete draft before publishing", "draft_required");
  const draft = await versionById(page.draft_version_id);
  if (!draft || draft.status !== "draft") throw new HttpError(409, "The legal draft changed. Refresh and try again.", "draft_changed");
  legalDraftSchema.parse({ slug, documents: draft.documents });
  const allText = (["en", "fr", "ar"] as const).flatMap((locale) => [draft.documents[locale].title,
    ...draft.documents[locale].sections.flatMap((section) => [section.heading, section.body])]).join("\n");
  if (/\bINCOMPLETE\b|\bINCOMPLET\b|غير مكتمل|à compléter|to be completed/i.test(allText)) {
    throw new HttpError(409, "Replace every incomplete marker with verified information before publishing", "legal_information_incomplete");
  }
  if (["legal-notice", "terms", "privacy", "contact"].includes(slug)) {
    const business = (await getStoreSettings()).business;
    if (![business.legalName, business.ownerName, business.legalForm, business.address, business.phone, business.email].every(Boolean)) {
      throw new HttpError(409, "Complete and verify the required business identity and contact settings before publishing", "business_information_incomplete");
    }
  }
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  if (page.published_version_id) statements.push(getDatabase().prepare("UPDATE legal_page_versions SET status = 'archived' WHERE id = ? AND status = 'published'").bind(page.published_version_id));
  statements.push(getDatabase().prepare("UPDATE legal_page_versions SET status = 'published', published_at = ?, created_by = ? WHERE id = ? AND status = 'draft'").bind(now, adminEmail, draft.id));
  statements.push(getDatabase().prepare("UPDATE legal_pages SET published_version_id = ?, draft_version_id = NULL, updated_at = ? WHERE slug = ? AND draft_version_id = ?")
    .bind(draft.id, now, slug, draft.id));
  const result = await getDatabase().batch(statements);
  if (!result[result.length - 1].meta.changes) throw new HttpError(409, "The legal draft changed. Refresh and try again.", "draft_changed");
  return (await versionById(draft.id))!;
}

export async function restoreLegalVersion(slug: LegalPageSlug, sourceId: string, adminEmail: string): Promise<LegalVersion> {
  const source = await versionById(sourceId);
  if (!source || source.slug !== slug || source.status === "draft") throw new HttpError(404, "Legal version not found", "version_not_found");
  const page = await pageRow(slug);
  const max = await getDatabase().prepare("SELECT MAX(version) AS value FROM legal_page_versions WHERE page_slug = ?").bind(slug).first<{ value: number }>();
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const version = Number(max?.value ?? 0) + 1; const d = source.documents;
  const statements: D1PreparedStatement[] = [];
  if (page.published_version_id) statements.push(getDatabase().prepare("UPDATE legal_page_versions SET status = 'archived' WHERE id = ? AND status = 'published'").bind(page.published_version_id));
  statements.push(getDatabase().prepare(`INSERT INTO legal_page_versions (id, page_slug, version, title_en, title_fr, title_ar, sections_en, sections_fr, sections_ar, status, created_by, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`).bind(id, slug, version, d.en.title, d.fr.title, d.ar.title, JSON.stringify(d.en.sections), JSON.stringify(d.fr.sections), JSON.stringify(d.ar.sections), adminEmail, now, now));
  statements.push(getDatabase().prepare("UPDATE legal_pages SET published_version_id = ?, draft_version_id = NULL, updated_at = ? WHERE slug = ?").bind(id, now, slug));
  await getDatabase().batch(statements);
  return (await versionById(id))!;
}
