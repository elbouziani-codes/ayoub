"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Clock3, Eye, FileClock, LifeBuoy, LoaderCircle, Plus, RotateCcw, Save, Settings2, ShieldCheck, Trash2 } from "lucide-react";
import LegalDocument from "@/components/legal-document";
import { legalPageLabels, legalPageSlugs, type LegalPageSlug, type LegalVersion, type Locale, type LocalizedLegalDocument } from "@/lib/legal";
import type { StoreSettings } from "@/lib/server/store-settings";

type PageState = { slug: LegalPageSlug; draft: LegalVersion | null; published: LegalVersion | null; history: LegalVersion[] };
type AuditLog = { id: string; adminEmail: string; action: string; resourceType: string; resourceId: string; changes: unknown; createdAt: string };
type Tab = "documents" | "settings" | "support" | "audit";
type SupportCase = Record<string, string | number | null>;

const copy = {
  en: { documents: "Legal documents", settings: "Business & checkout", support: "Complaints & returns", audit: "Audit log", save: "Save draft", publish: "Publish", preview: "Preview", history: "Revision history", restore: "Restore", add: "Add section", incomplete: "Complete all three languages before publishing.", saved: "Draft saved.", published: "Version published.", restored: "Historical version restored as a new publication.", business: "Verified business information", shipping: "Shipping settings", appearance: "Store appearance", checkout: "Checkout settings", settingsSaved: "Settings saved.", noPublished: "Not published", draft: "Draft", live: "Published", confirmPublish: "Publish this version? It will become the version accepted by new orders.", confirmRestore: "Restore this historical version as a new publication?" },
  fr: { documents: "Documents juridiques", settings: "Entreprise et commande", support: "Réclamations et retours", audit: "Journal d’audit", save: "Enregistrer le brouillon", publish: "Publier", preview: "Aperçu", history: "Historique des versions", restore: "Restaurer", add: "Ajouter une section", incomplete: "Complétez les trois langues avant publication.", saved: "Brouillon enregistré.", published: "Version publiée.", restored: "Version historique restaurée comme nouvelle publication.", business: "Informations vérifiées de l’entreprise", shipping: "Paramètres de livraison", appearance: "Apparence de la boutique", checkout: "Paramètres de commande", settingsSaved: "Paramètres enregistrés.", noPublished: "Non publié", draft: "Brouillon", live: "Publiée", confirmPublish: "Publier cette version ? Elle sera acceptée par les nouvelles commandes.", confirmRestore: "Restaurer cette version historique comme nouvelle publication ?" },
  ar: { documents: "الوثائق القانونية", settings: "بيانات المتجر والطلب", support: "الشكايات والإرجاع", audit: "سجل التدقيق", save: "حفظ المسودة", publish: "نشر", preview: "معاينة", history: "سجل الإصدارات", restore: "استعادة", add: "إضافة قسم", incomplete: "أكمل اللغات الثلاث قبل النشر.", saved: "تم حفظ المسودة.", published: "تم نشر الإصدار.", restored: "تمت استعادة الإصدار التاريخي كنشر جديد.", business: "بيانات الشركة الموثقة", shipping: "إعدادات التوصيل", appearance: "مظهر المتجر", checkout: "إعدادات الطلب", settingsSaved: "تم حفظ الإعدادات.", noPublished: "غير منشور", draft: "مسودة", live: "منشور", confirmPublish: "نشر هذا الإصدار؟ سيصبح الإصدار الذي تقبله الطلبات الجديدة.", confirmRestore: "استعادة هذا الإصدار التاريخي كنشر جديد؟" },
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin", ...options });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function AdminLegalCms({ lang }: { lang: Locale }) {
  const t = copy[lang]; const [tab, setTab] = useState<Tab>("documents"); const [pages, setPages] = useState<PageState[]>([]);
  const [selected, setSelected] = useState<LegalPageSlug>("legal-notice"); const [editorLocale, setEditorLocale] = useState<Locale>(lang);
  const [draft, setDraft] = useState<Record<Locale, LocalizedLegalDocument> | null>(null); const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [supportCases, setSupportCases] = useState<{ complaints: SupportCase[]; returns: SupportCase[] }>({ complaints: [], returns: [] });
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [legal, config, audit, support] = await Promise.all([request<{ pages: PageState[] }>("/api/admin/legal"), request<{ settings: StoreSettings }>("/api/admin/settings"), request<{ logs: AuditLog[] }>("/api/admin/audit"), request<{ complaints: SupportCase[]; returns: SupportCase[] }>("/api/admin/support")]);
      setPages(legal.pages); setSettings(config.settings); setLogs(audit.logs); setSupportCases(support);
    } catch (value) { setError(value instanceof Error ? value.message : "Could not load CMS"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const page = useMemo(() => pages.find((item) => item.slug === selected), [pages, selected]);
  useEffect(() => { const source = page?.draft ?? page?.published; setDraft(source ? structuredClone(source.documents) : null); setPreview(false); }, [page]);

  const changeDocument = (change: (document: LocalizedLegalDocument) => LocalizedLegalDocument) => setDraft((current) => current ? { ...current, [editorLocale]: change(current[editorLocale]) } : current);
  const changeSection = (index: number, field: "heading" | "body", value: string) => changeDocument((document) => ({ ...document, sections: document.sections.map((section, at) => at === index ? { ...section, [field]: value } : section) }));
  const move = (index: number, direction: -1 | 1) => setDraft((current) => {
    if (!current || index + direction < 0 || index + direction >= current.en.sections.length) return current;
    const next = structuredClone(current);
    for (const locale of ["en", "fr", "ar"] as const) [next[locale].sections[index], next[locale].sections[index + direction]] = [next[locale].sections[index + direction], next[locale].sections[index]];
    return next;
  });
  const remove = (index: number) => setDraft((current) => current ? Object.fromEntries((["en", "fr", "ar"] as const).map((locale) => [locale, { ...current[locale], sections: current[locale].sections.filter((_, at) => at !== index) }])) as Record<Locale, LocalizedLegalDocument> : current);
  const add = () => setDraft((current) => {
    if (!current) return current; const id = `section-${crypto.randomUUID().slice(0, 8)}`;
    const labels = { en: { heading: "New section", body: "Complete this section before publishing." }, fr: { heading: "Nouvelle section", body: "Complétez cette section avant publication." }, ar: { heading: "قسم جديد", body: "أكمل هذا القسم قبل النشر." } };
    return Object.fromEntries((["en", "fr", "ar"] as const).map((locale) => [locale, { ...current[locale], sections: [...current[locale].sections, { id, ...labels[locale] }] }])) as Record<Locale, LocalizedLegalDocument>;
  });

  async function saveDraft() {
    if (!draft) return; setBusy(true); setError(""); setMessage("");
    try { await request("/api/admin/legal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: selected, documents: draft }) }); setMessage(t.saved); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : t.incomplete); } finally { setBusy(false); }
  }
  async function publish() {
    if (!confirm(t.confirmPublish)) return; setBusy(true); setError("");
    try { await request("/api/admin/legal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", slug: selected }) }); setMessage(t.published); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : t.incomplete); } finally { setBusy(false); }
  }
  async function restore(versionId: string) {
    if (!confirm(t.confirmRestore)) return; setBusy(true); setError("");
    try { await request("/api/admin/legal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", slug: selected, versionId }) }); setMessage(t.restored); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "Restore failed"); } finally { setBusy(false); }
  }
  async function saveSettings() {
    if (!settings) return; setBusy(true); setError("");
    try { const result = await request<{ settings: StoreSettings }>("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); setSettings(result.settings); setMessage(t.settingsSaved); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "Save failed"); } finally { setBusy(false); }
  }
  async function updateCase(type: "complaint" | "return", item: SupportCase, status: string, adminNotes: string) {
    setBusy(true); setError(""); try { await request(`/api/admin/support/${type}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, adminNotes }) }); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "Update failed"); } finally { setBusy(false); }
  }

  if (loading && !pages.length) return <div className="adm-loading"><LoaderCircle className="adm-spin" /> CMS…</div>;
  return <section className="adm-legal-cms">
    <div className="adm-cms-tabs">{(["documents", "settings", "support", "audit"] as const).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "documents" ? <FileClock size={16} /> : name === "settings" ? <Settings2 size={16} /> : name === "support" ? <LifeBuoy size={16} /> : <ShieldCheck size={16} />}{t[name]}</button>)}</div>
    {message && <p className="adm-content-success" role="status"><Check size={16} />{message}</p>}{error && <p className="adm-form-error" role="alert">{error}</p>}
    {tab === "documents" && page && draft && <div className="adm-legal-layout">
      <aside className="adm-legal-list">{legalPageSlugs.map((slug) => { const item = pages.find((entry) => entry.slug === slug); return <button className={selected === slug ? "active" : ""} key={slug} onClick={() => setSelected(slug)}><span>{legalPageLabels[slug][lang]}</span><small>{item?.published ? `${t.live} v${item.published.version}` : t.noPublished}{item?.draft ? ` · ${t.draft}` : ""}</small></button>; })}</aside>
      <div className="adm-legal-editor">
        <div className="adm-legal-toolbar"><div className="adm-locale-tabs">{(["en", "fr", "ar"] as const).map((locale) => <button key={locale} className={editorLocale === locale ? "active" : ""} onClick={() => setEditorLocale(locale)}>{locale.toUpperCase()}</button>)}</div><div><button className="adm-button adm-button-secondary" onClick={() => setPreview((value) => !value)}><Eye size={15} />{t.preview}</button><button className="adm-button adm-button-primary" disabled={busy} onClick={() => void saveDraft()}>{busy ? <LoaderCircle className="adm-spin" size={15} /> : <Save size={15} />}{t.save}</button><button className="adm-button adm-publish" disabled={busy || !page.draft} onClick={() => void publish()}><Check size={15} />{t.publish}</button></div></div>
        {preview ? <div className="adm-legal-preview"><LegalDocument document={draft[editorLocale]} /></div> : <div className="adm-legal-fields"><label className="adm-field"><span>Title — {editorLocale.toUpperCase()}</span><input value={draft[editorLocale].title} maxLength={240} onChange={(event) => changeDocument((document) => ({ ...document, title: event.target.value }))} dir={editorLocale === "ar" ? "rtl" : "ltr"} /></label>{draft[editorLocale].sections.map((section, index) => <article className="adm-legal-section" key={section.id}><div><code>{section.id}</code><span><button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp size={14} /></button><button disabled={index === draft[editorLocale].sections.length - 1} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown size={14} /></button><button onClick={() => remove(index)} aria-label="Remove"><Trash2 size={14} /></button></span></div><label className="adm-field"><span>Heading</span><input value={section.heading} maxLength={200} onChange={(event) => changeSection(index, "heading", event.target.value)} dir={editorLocale === "ar" ? "rtl" : "ltr"} /></label><label className="adm-field"><span>Content · paragraphs, - lists, | tables | and [links](https://…)</span><textarea rows={8} value={section.body} maxLength={20000} onChange={(event) => changeSection(index, "body", event.target.value)} dir={editorLocale === "ar" ? "rtl" : "ltr"} /></label></article>)}<button className="adm-button adm-button-secondary" onClick={add}><Plus size={15} />{t.add}</button></div>}
        <section className="adm-version-history"><h3><Clock3 size={16} />{t.history}</h3>{page.history.map((version) => <div key={version.id}><span><strong>v{version.version}</strong><small>{version.status} · {new Date(version.createdAt).toLocaleString()}</small></span>{version.status !== "draft" && version.id !== page.published?.id && <button className="adm-button adm-button-secondary" disabled={busy} onClick={() => void restore(version.id)}><RotateCcw size={14} />{t.restore}</button>}</div>)}</section>
      </div>
    </div>}
    {tab === "settings" && settings && <SettingsForm lang={lang} settings={settings} setSettings={setSettings} save={() => void saveSettings()} busy={busy} labels={t} />}
    {tab === "support" && <div className="adm-support-grid"><SupportList title={t.support} type="complaint" items={supportCases.complaints} busy={busy} update={updateCase} /><SupportList title={lang === "ar" ? "طلبات الإرجاع" : lang === "fr" ? "Demandes de retour" : "Return requests"} type="return" items={supportCases.returns} busy={busy} update={updateCase} /></div>}
    {tab === "audit" && <section className="adm-panel adm-audit"><h2>{t.audit}</h2>{logs.map((log) => <article key={log.id}><ShieldCheck size={16} /><div><strong>{log.action}</strong><span>{log.resourceType} / {log.resourceId}</span><small>{log.adminEmail} · {new Date(log.createdAt).toLocaleString()}</small></div></article>)}</section>}
  </section>;
}

function SettingsForm({ settings, setSettings, save, busy, labels }: { lang: Locale; settings: StoreSettings; setSettings: (value: StoreSettings) => void; save: () => void; busy: boolean; labels: typeof copy.en }) {
  const businessFields: [keyof StoreSettings["business"], string][] = [["legalName","Legal name"],["commercialName","Commercial name"],["ownerName","Owner / company identity"],["legalForm","Legal form"],["address","Business address"],["phone","Support telephone"],["email","Business email"],["rc","RC"],["taxId","IF"],["ice","ICE"],["capital","Registered capital"],["authorizations","Authorizations"],["hostingProvider","Hosting provider"],["cndpReference","CNDP reference"],["privacyContact","Privacy contact"]];
  return <div className="adm-settings-grid"><section className="adm-panel"><h2>{labels.business}</h2><div className="adm-settings-fields">{businessFields.map(([key,label]) => <label className={`adm-field ${["address","authorizations"].includes(key) ? "wide" : ""}`} key={key}><span>{label}</span>{["address","authorizations"].includes(key) ? <textarea rows={3} value={settings.business[key]} onChange={(event) => setSettings({ ...settings, business: { ...settings.business, [key]: event.target.value } })} /> : <input type={key === "email" ? "email" : "text"} value={settings.business[key]} onChange={(event) => setSettings({ ...settings, business: { ...settings.business, [key]: event.target.value } })} />}</label>)}</div></section>
    <section className="adm-panel"><h2>{labels.shipping}</h2><div className="adm-settings-fields"><NumberField label="Fee (MAD)" value={settings.shipping.fee} set={(fee) => setSettings({ ...settings, shipping: { ...settings.shipping, fee } })} /><NumberField label="Free delivery threshold" value={settings.shipping.freeThreshold} set={(freeThreshold) => setSettings({ ...settings, shipping: { ...settings.shipping, freeThreshold } })} /><NumberField label="Minimum days" value={settings.shipping.estimatedDaysMin} set={(estimatedDaysMin) => setSettings({ ...settings, shipping: { ...settings.shipping, estimatedDaysMin } })} /><NumberField label="Maximum days" value={settings.shipping.estimatedDaysMax} set={(estimatedDaysMax) => setSettings({ ...settings, shipping: { ...settings.shipping, estimatedDaysMax } })} /><label className="adm-field wide"><span>Delivery cities (one per line)</span><textarea rows={6} value={settings.shipping.cities.join("\n")} onChange={(event) => setSettings({ ...settings, shipping: { ...settings.shipping, cities: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) } })} /></label><label className="adm-check wide"><input type="checkbox" checked={settings.shipping.codEnabled} onChange={(event) => setSettings({ ...settings, shipping: { ...settings.shipping, codEnabled: event.target.checked } })} />Cash on delivery enabled</label></div></section>
    <section className="adm-panel"><h2>{labels.appearance}</h2><div className="adm-settings-fields"><label className="adm-field"><span>Primary color</span><input type="color" value={settings.appearance.primaryColor} onChange={(event) => setSettings({ ...settings, appearance: { ...settings.appearance, primaryColor: event.target.value } })} /></label><label className="adm-field"><span>Secondary color</span><input type="color" value={settings.appearance.secondaryColor} onChange={(event) => setSettings({ ...settings, appearance: { ...settings.appearance, secondaryColor: event.target.value } })} /></label><label className="adm-field"><span>Default theme</span><select value={settings.appearance.defaultTheme} onChange={(event) => setSettings({ ...settings, appearance: { ...settings.appearance, defaultTheme: event.target.value as StoreSettings["appearance"]["defaultTheme"] } })}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label className="adm-field"><span>Default language</span><select value={settings.defaultLocale} onChange={(event) => setSettings({ ...settings, defaultLocale: event.target.value as Locale })}><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></select></label></div></section>
    <section className="adm-panel"><h2>{labels.checkout}</h2><div className="adm-settings-fields"><label className="adm-field wide"><span>Checkout instructions</span><textarea rows={4} value={settings.checkout.instructions} onChange={(event) => setSettings({ ...settings, checkout: { ...settings.checkout, instructions: event.target.value } })} /></label><label className="adm-field wide"><span>Confirmation message</span><textarea rows={4} value={settings.checkout.confirmationMessage} onChange={(event) => setSettings({ ...settings, checkout: { ...settings.checkout, confirmationMessage: event.target.value } })} /></label><label className="adm-check wide"><input type="checkbox" checked={settings.checkout.marketingEnabled} onChange={(event) => setSettings({ ...settings, checkout: { ...settings.checkout, marketingEnabled: event.target.checked } })} />Show optional marketing consent</label></div><button className="adm-button adm-button-primary" disabled={busy} onClick={save}>{busy ? <LoaderCircle className="adm-spin" size={15} /> : <Save size={15} />}{labels.save}</button></section>
  </div>;
}
function NumberField({ label, value, set }: { label: string; value: number; set: (value: number) => void }) { return <label className="adm-field"><span>{label}</span><input type="number" min="0" value={value} onChange={(event) => set(Number(event.target.value))} /></label>; }

function SupportList({ title, type, items, busy, update }: { title: string; type: "complaint" | "return"; items: SupportCase[]; busy: boolean; update: (type: "complaint" | "return", item: SupportCase, status: string, notes: string) => Promise<void> }) {
  const statuses = type === "complaint" ? ["open","reviewing","resolved","closed"] : ["requested","approved","rejected","received","refunded"];
  return <section className="adm-panel adm-support-list"><h2>{title}<span>{items.length}</span></h2>{items.length ? items.map((item) => <SupportCaseEditor key={String(item.id)} item={item} type={type} statuses={statuses} busy={busy} update={update} />) : <p>No cases.</p>}</section>;
}
function SupportCaseEditor({ item, type, statuses, busy, update }: { item: SupportCase; type: "complaint" | "return"; statuses: string[]; busy: boolean; update: (type: "complaint" | "return", item: SupportCase, status: string, notes: string) => Promise<void> }) {
  const [status,setStatus]=useState(String(item.status)); const [notes,setNotes]=useState(String(item.admin_notes??""));
  return <article><header><strong>{String(item.reference)}</strong><small>{String(item.order_number??item.customer_name??"")} · {new Date(String(item.created_at)).toLocaleString()}</small></header>{item.subject&&<h3>{String(item.subject)}</h3>}<p>{String(item.message??item.details??item.reason??"")}</p><div><select value={status} onChange={(event)=>setStatus(event.target.value)}>{statuses.map((value)=><option key={value}>{value}</option>)}</select><textarea value={notes} onChange={(event)=>setNotes(event.target.value)} placeholder="Internal notes" rows={2}/><button className="adm-button adm-button-primary" disabled={busy} onClick={()=>void update(type,item,status,notes)}><Save size={14}/>Save</button></div></article>;
}
