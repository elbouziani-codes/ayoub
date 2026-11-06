"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, EyeOff, KeyRound, LoaderCircle, RefreshCw, Save, ShieldCheck } from "lucide-react";
import "./account.css";

type Language = "en" | "fr" | "ar";
type Account = { email: string; recoveryMethod: "chatgpt"; recoveryEmail: string };
type ErrorKey = "loadError" | "saveError" | "invalidPassword" | "passwordLength" | "passwordMismatch" | "noChanges" | "rateLimit" | "accountChanged";
type ApiError = { code?: string; retryAfter?: unknown; ok?: boolean };

const words = {
  en: {
    title: "Sign-in details", subtitle: "Change your email, your password, or both.", email: "Administrator email",
    currentPassword: "Current password", currentHelp: "Enter your current password to confirm these changes.",
    newPassword: "New password", optional: "Optional", passwordHelp: "Use 12–256 characters. Leave blank to keep your current password.",
    confirmPassword: "Confirm new password", showPassword: "Show passwords", hidePassword: "Hide passwords",
    save: "Save changes & sign out", saving: "Saving…", loading: "Loading your account…", retry: "Try again",
    sessionNote: "Saving signs you out on all devices. Sign in again with your updated details.",
    recoveryTitle: "Keep your way back in.", recoveryDescription: "Forgot your password? Recover access using this verified ChatGPT account.",
    recoveryNote: "Changing your administrator email keeps this recovery account the same.", recovery: "Reset a forgotten password",
    passwordRequired: "Sign in with your administrator password to change your account details. If you have forgotten it, recover access with your verified ChatGPT account.",
    loadError: "We couldn’t load your account. Please try again.", saveError: "We couldn’t save your changes. Please try again.",
    invalidPassword: "Your current password is incorrect. Please try again.", passwordLength: "Your new password must contain 12–256 characters.",
    passwordMismatch: "The new passwords do not match.", noChanges: "Change your email or enter a new password first.",
    rateLimit: "Too many attempts. Please wait before trying again.", accountChanged: "Your account changed in another session. Sign in again to continue.",
    signInAgain: "Sign in again", retryIn: "Try again in", seconds: "seconds",
  },
  fr: {
    title: "Informations de connexion", subtitle: "Modifiez votre e-mail, votre mot de passe ou les deux.", email: "E-mail administrateur",
    currentPassword: "Mot de passe actuel", currentHelp: "Saisissez votre mot de passe actuel pour confirmer ces modifications.",
    newPassword: "Nouveau mot de passe", optional: "Facultatif", passwordHelp: "Utilisez 12 à 256 caractères. Laissez vide pour conserver le mot de passe actuel.",
    confirmPassword: "Confirmer le nouveau mot de passe", showPassword: "Afficher les mots de passe", hidePassword: "Masquer les mots de passe",
    save: "Enregistrer et se déconnecter", saving: "Enregistrement…", loading: "Chargement de votre compte…", retry: "Réessayer",
    sessionNote: "L’enregistrement vous déconnecte de tous les appareils. Reconnectez-vous avec vos nouvelles informations.",
    recoveryTitle: "Gardez un accès à votre compte.", recoveryDescription: "Mot de passe oublié ? Récupérez l’accès avec ce compte ChatGPT vérifié.",
    recoveryNote: "La modification de votre e-mail administrateur ne change pas ce compte de récupération.", recovery: "Réinitialiser un mot de passe oublié",
    passwordRequired: "Connectez-vous avec votre mot de passe administrateur pour modifier votre compte. Si vous l’avez oublié, récupérez l’accès avec votre compte ChatGPT vérifié.",
    loadError: "Impossible de charger votre compte. Veuillez réessayer.", saveError: "Impossible d’enregistrer vos modifications. Veuillez réessayer.",
    invalidPassword: "Votre mot de passe actuel est incorrect. Veuillez réessayer.", passwordLength: "Votre nouveau mot de passe doit contenir 12 à 256 caractères.",
    passwordMismatch: "Les nouveaux mots de passe ne correspondent pas.", noChanges: "Modifiez votre e-mail ou saisissez un nouveau mot de passe.",
    rateLimit: "Trop de tentatives. Patientez avant de réessayer.", accountChanged: "Votre compte a été modifié dans une autre session. Reconnectez-vous pour continuer.",
    signInAgain: "Se reconnecter", retryIn: "Réessayez dans", seconds: "secondes",
  },
  ar: {
    title: "بيانات تسجيل الدخول", subtitle: "غيّر البريد الإلكتروني أو كلمة المرور أو كليهما.", email: "البريد الإلكتروني للمسؤول",
    currentPassword: "كلمة المرور الحالية", currentHelp: "أدخل كلمة المرور الحالية لتأكيد هذه التغييرات.",
    newPassword: "كلمة مرور جديدة", optional: "اختياري", passwordHelp: "استخدم من 12 إلى 256 حرفاً. اترك الحقل فارغاً للاحتفاظ بكلمة المرور الحالية.",
    confirmPassword: "تأكيد كلمة المرور الجديدة", showPassword: "إظهار كلمات المرور", hidePassword: "إخفاء كلمات المرور",
    save: "حفظ التغييرات وتسجيل الخروج", saving: "جارٍ الحفظ…", loading: "جارٍ تحميل حسابك…", retry: "إعادة المحاولة",
    sessionNote: "سيتم تسجيل خروجك من جميع الأجهزة بعد الحفظ. سجّل الدخول مجدداً ببياناتك الجديدة.",
    recoveryTitle: "احتفظ بطريقة لاستعادة حسابك.", recoveryDescription: "نسيت كلمة المرور؟ استعد الوصول باستخدام حساب ChatGPT الموثق أدناه.",
    recoveryNote: "تغيير بريد المسؤول لا يغير حساب الاسترداد هذا.", recovery: "إعادة تعيين كلمة مرور منسية",
    passwordRequired: "سجّل الدخول بكلمة مرور المسؤول لتغيير بيانات حسابك. إذا نسيتها، استعد الوصول باستخدام حساب ChatGPT الموثق.",
    loadError: "تعذر تحميل حسابك. حاول مجدداً.", saveError: "تعذر حفظ التغييرات. حاول مجدداً.",
    invalidPassword: "كلمة المرور الحالية غير صحيحة. حاول مجدداً.", passwordLength: "يجب أن تتكون كلمة المرور الجديدة من 12 إلى 256 حرفاً.",
    passwordMismatch: "كلمتا المرور الجديدتان غير متطابقتين.", noChanges: "غيّر البريد الإلكتروني أو أدخل كلمة مرور جديدة أولاً.",
    rateLimit: "محاولات كثيرة. يُرجى الانتظار قبل إعادة المحاولة.", accountChanged: "تم تغيير حسابك في جلسة أخرى. سجّل الدخول مجدداً للمتابعة.",
    signInAgain: "تسجيل الدخول مجدداً", retryIn: "يمكنك المحاولة بعد", seconds: "ثانية",
  },
};

function retryDelay(response: Response, data: ApiError): number {
  const bodyDelay = Number(data.retryAfter);
  const header = response.headers.get("Retry-After");
  const headerDelay = header && /^\d+$/.test(header) ? Number(header) : header ? (Date.parse(header) - Date.now()) / 1000 : 0;
  const delay = Number.isFinite(bodyDelay) && bodyDelay > 0 ? bodyDelay : headerDelay;
  return Number.isFinite(delay) && delay > 0 ? Math.ceil(delay) : 60;
}

export default function AdminAccountSettings({ lang, onSessionExpired, onSaved }: { lang: Language; onSessionExpired: () => void; onSaved: () => void }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [reload, setReload] = useState(0);
  const t = words[lang];

  const loadAccount = useCallback((signal: AbortSignal) =>
    fetch("/api/admin/account", { cache: "no-store", credentials: "same-origin", signal }).then(async response => {
      const data = await response.json().catch(() => ({})) as Account & ApiError;
      if (signal.aborted) return;
      if (response.status === 401) { onSessionExpired(); return; }
      if (response.status === 403 && data.code === "password_login_required") { setPasswordRequired(true); return; }
      if (!response.ok || typeof data.email !== "string" || typeof data.recoveryEmail !== "string") throw new Error("Account unavailable");
      setAccount(data);
      setEmail(data.email);
    }).catch(() => {
      if (!signal.aborted) setError("loadError");
    }).finally(() => {
      if (!signal.aborted) setLoading(false);
    }), [onSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAccount(controller.signal);
    return () => controller.abort();
  }, [loadAccount, reload]);

  useEffect(() => {
    if (!retryUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetrySeconds(remaining);
      if (!remaining) { setRetryUntil(0); setError(current => current === "rateLimit" ? null : current); }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [retryUntil]);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account || submitting || retrySeconds > 0) return;
    const updatedEmail = email.trim().toLowerCase();
    const emailChanged = updatedEmail !== account.email.toLowerCase();
    if (!emailChanged && !newPassword) { setError("noChanges"); return; }
    if (newPassword && (newPassword.length < 12 || newPassword.length > 256)) { setError("passwordLength"); return; }
    if (newPassword !== confirmPassword) { setError("passwordMismatch"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/account", {
        method: "PATCH", cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, ...(emailChanged ? { email: updatedEmail } : {}), ...(newPassword ? { newPassword, confirmPassword } : {}) }),
      });
      const data = await response.json().catch(() => ({})) as ApiError;
      if (response.status === 401 && data.code === "invalid_current_password") { setCurrentPassword(""); setError("invalidPassword"); }
      else if (response.status === 401) { onSessionExpired(); }
      else if (response.status === 429) {
        const seconds = retryDelay(response, data);
        setRetrySeconds(seconds);
        setRetryUntil(Date.now() + seconds * 1000);
        setError("rateLimit");
      } else if (response.status === 409 && data.code === "account_changed") { setError("accountChanged"); }
      else if (!response.ok || !data.ok) { setError("saveError"); }
      else {
        setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        onSaved();
      }
    } catch { setError("saveError"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="adm-loading" role="status"><LoaderCircle size={25} className="adm-spin" /><span>{t.loading}</span></div>;
  if (passwordRequired) return <section className="adm-panel adm-account-gate"><KeyRound size={28} strokeWidth={1.5} /><h2>{t.title}</h2><p>{t.passwordRequired}</p><Link className="adm-button adm-button-primary" href="/admin/reset-password">{t.recovery}<ArrowUpRight size={16} /></Link></section>;
  if (!account) return <div className="adm-alert" role="alert"><span>{t.loadError}</span><button type="button" onClick={() => { setError(null); setLoading(true); setReload(value => value + 1); }}>{t.retry}<RefreshCw size={14} /></button></div>;

  return <div className="adm-account">
    <section className="adm-panel adm-account-panel" aria-labelledby="admin-account-title">
      <div className="adm-panel-head"><div><h2 id="admin-account-title"><KeyRound size={17} />{t.title}</h2><p className="adm-account-subtitle">{t.subtitle}</p></div></div>
      <form className="adm-account-form" onSubmit={saveAccount} aria-busy={submitting}>
        <label className="adm-account-field" htmlFor="account-email"><span>{t.email}</span><input id="account-email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={submitting} /></label>
        <label className="adm-account-field" htmlFor="account-current-password"><span>{t.currentPassword}</span><input id="account-current-password" name="currentPassword" type={showPasswords ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" spellCheck={false} dir="ltr" maxLength={256} required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={submitting} aria-invalid={error === "invalidPassword"} aria-describedby={`account-current-help${error === "invalidPassword" ? " account-error" : ""}`} /><small id="account-current-help">{t.currentHelp}</small></label>
        <div className="adm-account-password-fields">
          <label className="adm-account-field" htmlFor="account-new-password"><span>{t.newPassword}<small>{t.optional}</small></span><input id="account-new-password" name="newPassword" type={showPasswords ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} dir="ltr" minLength={12} maxLength={256} value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={submitting} aria-invalid={error === "passwordLength" || error === "passwordMismatch"} aria-describedby="account-password-help" /></label>
          <label className="adm-account-field" htmlFor="account-confirm-password"><span>{t.confirmPassword}</span><input id="account-confirm-password" name="confirmPassword" type={showPasswords ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} dir="ltr" minLength={12} maxLength={256} required={!!newPassword} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={submitting} aria-invalid={error === "passwordMismatch"} aria-describedby={error === "passwordMismatch" ? "account-error" : undefined} /></label>
        </div>
        <p className="adm-account-help" id="account-password-help">{t.passwordHelp}</p>
        <button type="button" className="adm-account-show" onClick={() => setShowPasswords(value => !value)} aria-pressed={showPasswords} disabled={submitting}>{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}{showPasswords ? t.hidePassword : t.showPassword}</button>
        {error && <div className="adm-account-error" id="account-error" role="alert"><p>{t[error]}</p>{error === "accountChanged" && <button type="button" className="adm-text-button" onClick={onSessionExpired}>{t.signInAgain}<ArrowUpRight size={14} /></button>}</div>}
        {retrySeconds > 0 && <p className="adm-account-help" role="status" aria-live="off">{t.retryIn} {new Intl.NumberFormat(lang).format(retrySeconds)} {t.seconds}</p>}
        <div className="adm-account-save"><p><ShieldCheck size={16} />{t.sessionNote}</p><button type="submit" className="adm-button adm-button-primary" disabled={submitting || retrySeconds > 0 || error === "accountChanged"}>{submitting ? <LoaderCircle size={16} className="adm-spin" /> : <Save size={16} />}{submitting ? t.saving : t.save}</button></div>
      </form>
    </section>
    <aside className="adm-panel adm-account-recovery" aria-labelledby="admin-recovery-title"><span className="adm-account-recovery-icon"><ShieldCheck size={25} strokeWidth={1.5} /></span><h2 id="admin-recovery-title">{t.recoveryTitle}</h2><p>{t.recoveryDescription}</p><strong dir="ltr">{account.recoveryEmail}</strong><p>{t.recoveryNote}</p><Link href="/admin/reset-password" className="adm-text-button">{t.recovery}<ArrowUpRight size={14} /></Link></aside>
  </div>;
}
