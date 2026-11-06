"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, LoaderCircle, Pencil, Search } from "lucide-react";
import Image from "next/image";
import type { ContentOverrides, Locale, TranslationKey } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n";
import type { EditorialAsset } from "@/lib/types";
import { optimizeProductImage } from "@/lib/optimize-product-image";

type TextSet = Record<Locale, string>;
type Section = "navigation" | "home" | "collection" | "story" | "faq" | "footer" | "checkout" | "tracking" | "policies" | "seo";
const sectionStarts: Record<Section, TranslationKey> = {
  navigation: "freeTop", home: "heroBadge", collection: "collectionTag", story: "editorialTag",
  faq: "faqTag", footer: "footerDesc", checkout: "yourBag", tracking: "thankYou", policies: "shippingPolicy", seo: "seoTitle",
};
const copy = {
  fr: { title: "Contenu de la boutique", help: "Modifiez les textes visibles par vos clients. Chaque changement doit être renseigné en français, en arabe et en anglais avant d’être enregistré.", search: "Rechercher un texte…", all: "Toutes les sections", edit: "Modifier", save: "Enregistrer les 3 langues", saving: "Enregistrement…", cancel: "Annuler", saved: "Les trois versions ont été enregistrées.", error: "Impossible d’enregistrer. Réessayez.", required: "Renseignez les trois langues avant d’enregistrer.", everyLanguage: "Modifiez aussi les versions française, arabe et anglaise de ce texte.", loading: "Chargement du contenu…", empty: "Aucun texte trouvé.", current: "Texte actuel", sections: { navigation: "Navigation et annonces", home: "Accueil", collection: "Collection", story: "Histoire et valeurs", faq: "Questions fréquentes", footer: "Pied de page", checkout: "Panier et commande", tracking: "Suivi de commande", policies: "Politiques", seo: "Référencement" } },
  en: { title: "Store content", help: "Edit text customers see. Every change needs French, Arabic and English before saving.", search: "Search text…", all: "All sections", edit: "Edit", save: "Save all 3 languages", saving: "Saving…", cancel: "Cancel", saved: "All three versions were saved.", error: "Could not save. Please try again.", required: "Complete all three languages before saving.", everyLanguage: "Update this text in French, Arabic and English together.", loading: "Loading content…", empty: "No text found.", current: "Current text", sections: { navigation: "Navigation and notices", home: "Home", collection: "Collection", story: "Story and values", faq: "Frequently asked questions", footer: "Footer", checkout: "Bag and checkout", tracking: "Order tracking", policies: "Policies", seo: "Search listings" } },
  ar: { title: "محتوى المتجر", help: "غيّر النصوص التي يراها الزوار. يجب تعبئة الفرنسية والعربية والإنجليزية قبل حفظ أي تغيير.", search: "ابحث عن نص…", all: "كل الأقسام", edit: "تعديل", save: "حفظ اللغات الثلاث", saving: "جارٍ الحفظ…", cancel: "إلغاء", saved: "حُفظت النصوص باللغات الثلاث.", error: "تعذر الحفظ. حاول مجدداً.", required: "أكمل اللغات الثلاث قبل الحفظ.", everyLanguage: "غيّر نسخ النص بالفرنسية والعربية والإنجليزية معاً.", loading: "جارٍ تحميل المحتوى…", empty: "لم يُعثر على نص.", current: "النص الحالي", sections: { navigation: "القائمة والإعلانات", home: "الرئيسية", collection: "المجموعة", story: "القصة والقيم", faq: "الأسئلة الشائعة", footer: "تذييل الصفحة", checkout: "السلة والطلب", tracking: "تتبع الطلب", policies: "السياسات", seo: "نتائج البحث" } },
} as const;
const languageNames: Record<Locale, string> = { fr: "Français", ar: "العربية", en: "English" };
const languageOrder: Locale[] = ["fr", "ar", "en"];
const defaultAsset: EditorialAsset = { slot: "editorialImage", image: "/images/watch-blue.webp", en: "Blue dial watch detail", fr: "Détails d’une montre bleue", ar: "تفاصيل ساعة زرقاء" };
const mediaCopy = {
  fr: { title: "Image de la collection", help: "Changez l’image et décrivez-la en français, arabe et anglais.", choose: "Choisir une image", save: "Enregistrer l’image" },
  en: { title: "Collection image", help: "Change the image and describe it in French, Arabic and English.", choose: "Choose image", save: "Save image" },
  ar: { title: "صورة المجموعة", help: "غيّر الصورة واكتب وصفها بالفرنسية والعربية والإنجليزية.", choose: "اختر صورة", save: "حفظ الصورة" },
} as const;

function sectionFor(key: TranslationKey): Section {
  const keys = Object.keys(dictionaries.en);
  let section: Section = "navigation";
  for (const [name, start] of Object.entries(sectionStarts) as [Section, TranslationKey][]) {
    if (keys.indexOf(key) >= keys.indexOf(start)) section = name;
  }
  return section;
}

export default function AdminContentEditor({ lang }: { lang: Locale }) {
  const t = copy[lang];
  const [overrides, setOverrides] = useState<ContentOverrides>({});
  const [asset, setAsset] = useState<EditorialAsset>(defaultAsset);
  const [assetDraft, setAssetDraft] = useState<TextSet>({ en: defaultAsset.en, fr: defaultAsset.fr, ar: defaultAsset.ar });
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<Section | "all">("all");
  const [editing, setEditing] = useState<TranslationKey | null>(null);
  const [draft, setDraft] = useState<TextSet>({ fr: "", ar: "", en: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/content", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Content unavailable");
      return response.json() as Promise<{ overrides: ContentOverrides; editorialAsset: EditorialAsset }>;
    }).then((data) => { if (active) { setOverrides(data.overrides); setAsset(data.editorialAsset); setAssetDraft({ en: data.editorialAsset.en, fr: data.editorialAsset.fr, ar: data.editorialAsset.ar }); } })
      .catch(() => { if (active) setError(t.error); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t.error]);

  const value = (key: TranslationKey): TextSet => ({
    fr: overrides[key]?.fr ?? dictionaries.fr[key],
    ar: overrides[key]?.ar ?? dictionaries.ar[key],
    en: overrides[key]?.en ?? dictionaries.en[key],
  });
  const fields = useMemo(() => (Object.keys(dictionaries.fr) as TranslationKey[]).filter((key) => {
    if (section !== "all" && sectionFor(key) !== section) return false;
    const query = search.trim().toLocaleLowerCase();
    return !query || [key, ...languageOrder.map((locale) => overrides[key]?.[locale] ?? dictionaries[locale][key])]
      .some((text) => text.toLocaleLowerCase().includes(query));
  }), [search, section, overrides]);

  const startEditing = (key: TranslationKey) => { setEditing(key); setDraft(value(key)); setMessage(""); setError(""); };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (languageOrder.some((locale) => !draft[locale].trim())) { setError(t.required); return; }
    const changes = languageOrder.map((locale) => draft[locale].trim() !== value(editing)[locale]);
    if (changes.some(Boolean) && !changes.every(Boolean)) { setError(t.everyLanguage); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/content", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editing, ...draft }),
      });
      if (!response.ok) throw new Error(t.error);
      const data = await response.json() as { content: { key: TranslationKey } & TextSet };
      setOverrides((current) => ({ ...current, [editing]: { en: data.content.en, fr: data.content.fr, ar: data.content.ar } }));
      setEditing(null); setMessage(t.saved);
    } catch { setError(t.error); } finally { setBusy(false); }
  }

  async function saveAsset(event: FormEvent) {
    event.preventDefault();
    if (languageOrder.some((locale) => !assetDraft[locale].trim())) { setError(t.required); return; }
    const changed = languageOrder.map((locale) => assetDraft[locale].trim() !== asset[locale]);
    if ((assetFile || changed.some(Boolean)) && !changed.every(Boolean)) { setError(t.everyLanguage); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      let image = asset.image;
      if (assetFile) {
        const optimized = await optimizeProductImage(assetFile);
        const form = new FormData(); form.append("file", optimized, assetFile.name);
        const upload = await fetch("/api/admin/uploads", { method: "POST", body: form });
        if (!upload.ok) throw new Error(t.error);
        image = ((await upload.json()) as { url: string }).url;
      }
      const response = await fetch("/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "image", slot: "editorialImage", image, ...assetDraft }) });
      if (!response.ok) throw new Error(t.error);
      const data = await response.json() as { asset: EditorialAsset };
      setAsset(data.asset); setAssetDraft({ en: data.asset.en, fr: data.asset.fr, ar: data.asset.ar }); setAssetFile(null); setMessage(t.saved);
    } catch { setError(t.error); } finally { setBusy(false); }
  }

  return <section className="adm-panel adm-content-editor" aria-labelledby="adm-content-title">
    <div className="adm-content-intro"><h2 id="adm-content-title">{t.title}</h2><p>{t.help}</p></div>
    <div className="adm-content-tools"><label className="adm-search"><Search size={17} /><span className="adm-sr-only">{t.search}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} /></label><select value={section} onChange={(event) => setSection(event.target.value as Section | "all")} aria-label={t.all}><option value="all">{t.all}</option>{(Object.keys(sectionStarts) as Section[]).map((name) => <option key={name} value={name}>{t.sections[name]}</option>)}</select></div>
    {message && <p className="adm-content-success" role="status"><Check size={16} />{message}</p>}
    {error && <p className="adm-form-error" role="alert">{error}</p>}
    {!loading && (section === "all" || section === "collection") && <form className="adm-content-media" onSubmit={saveAsset}>
      <div className="adm-content-media-preview"><Image src={asset.image} alt={asset[lang]} width={180} height={180} unoptimized /></div>
      <div className="adm-content-media-fields"><h3>{mediaCopy[lang].title}</h3><p>{mediaCopy[lang].help}</p><label className="adm-content-file">{mediaCopy[lang].choose}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setAssetFile(event.target.files?.[0] ?? null)} /></label>{assetFile && <small>{assetFile.name}</small>}
        {languageOrder.map((locale) => <label className="adm-field" key={locale}><span>{languageNames[locale]} <em>*</em></span><input required maxLength={300} value={assetDraft[locale]} onChange={(event) => setAssetDraft((current) => ({ ...current, [locale]: event.target.value }))} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} /></label>)}
        <button className="adm-button adm-button-primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="adm-spin" size={15} /> : <Check size={15} />}{mediaCopy[lang].save}</button>
      </div>
    </form>}
    {loading ? <p className="adm-content-empty"><LoaderCircle className="adm-spin" size={18} />{t.loading}</p> : fields.length ? <div className="adm-content-list">{fields.map((key) => <article className="adm-content-item" key={key}>
      <div className="adm-content-item-head"><div><small>{t.sections[sectionFor(key)]}</small><strong>{value(key)[lang].slice(0, 100)}{value(key)[lang].length > 100 ? "…" : ""}</strong></div>{editing !== key && <button type="button" className="adm-button adm-button-secondary" onClick={() => startEditing(key)}><Pencil size={14} />{t.edit}</button>}</div>
      {editing === key && <form onSubmit={save} className="adm-content-form">{languageOrder.map((locale) => <label className="adm-field" key={locale}><span>{languageNames[locale]} <em>*</em></span><textarea required rows={draft[locale].length > 120 ? 5 : 2} maxLength={5000} value={draft[locale]} onChange={(event) => setDraft((current) => ({ ...current, [locale]: event.target.value }))} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} /></label>)}<div className="adm-content-actions"><button className="adm-button adm-button-secondary" type="button" disabled={busy} onClick={() => { setEditing(null); setError(""); }}>{t.cancel}</button><button className="adm-button adm-button-primary" disabled={busy} type="submit">{busy ? <LoaderCircle className="adm-spin" size={15} /> : <Check size={15} />}{busy ? t.saving : t.save}</button></div></form>}
    </article>)}</div> : <p className="adm-content-empty">{t.empty}</p>}
  </section>;
}
