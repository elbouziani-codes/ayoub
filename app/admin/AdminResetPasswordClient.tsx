"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CheckCircle2, ChevronDown, Eye, EyeOff, Globe2, KeyRound, LoaderCircle, LogOut, RefreshCw, ShieldCheck, Watch } from "lucide-react";

type Language = "en" | "fr" | "ar";
type RecoverySession = {
  authenticated: boolean;
  canReset: boolean;
  user: { email?: string; displayName?: string } | null;
};
type RecoveryError = "invalidPassword" | "mismatch" | "resetError" | "rateLimit" | "unavailable";

const words = {
  en: {
    language: "Language", security: "Account recovery", title: "A fresh start.",
    description: "Recover access to your store with a new administrator password.",
    loading: "Checking recovery access…", sessionError: "We couldn’t verify your recovery access.", retry: "Try again",
    verify: "Continue with the ChatGPT account that originally owns this store to verify your identity.",
    chatGPT: "Verify with ChatGPT", denied: "This account cannot reset the administrator password. Use the store owner’s ChatGPT account.",
    switchAccount: "Use another ChatGPT account", signedInAs: "Verified owner", newPassword: "New password", confirmPassword: "Confirm new password",
    showPassword: "Show password", hidePassword: "Hide password", passwordHelp: "Use 12–256 characters. A long, unique passphrase is a good choice.",
    sessionHelp: "Resetting your password signs out all administrator sessions. Sign in again with the new password.",
    reset: "Reset password", resetting: "Resetting password…", invalidPassword: "Choose a password with 12–256 characters.",
    mismatch: "The passwords do not match.", resetError: "We couldn’t reset your password. Please try again shortly.",
    rateLimit: "Too many reset attempts. Please wait before trying again.", retryIn: "Try again in", seconds: "seconds",
    unavailable: "Password recovery is currently unavailable. Please try again later.",
    successTitle: "Password reset.", success: "Your new password is ready. All administrator sessions have been signed out.",
    signIn: "Sign in with your new password", backLogin: "Back to administrator sign in", backStore: "Back to the store",
    protected: "Protected recovery · Store owner verification required",
  },
  fr: {
    language: "Langue", security: "Récupération du compte", title: "Un nouveau départ.",
    description: "Retrouvez l’accès à votre boutique avec un nouveau mot de passe administrateur.",
    loading: "Vérification de l’accès à la récupération…", sessionError: "Impossible de vérifier votre accès à la récupération.", retry: "Réessayer",
    verify: "Continuez avec le compte ChatGPT du propriétaire d’origine de cette boutique pour vérifier votre identité.",
    chatGPT: "Vérifier avec ChatGPT", denied: "Ce compte ne peut pas réinitialiser le mot de passe administrateur. Utilisez le compte ChatGPT du propriétaire de la boutique.",
    switchAccount: "Utiliser un autre compte ChatGPT", signedInAs: "Propriétaire vérifié", newPassword: "Nouveau mot de passe", confirmPassword: "Confirmer le nouveau mot de passe",
    showPassword: "Afficher le mot de passe", hidePassword: "Masquer le mot de passe", passwordHelp: "Utilisez 12 à 256 caractères. Privilégiez une phrase secrète longue et unique.",
    sessionHelp: "La réinitialisation déconnecte toutes les sessions administrateur. Reconnectez-vous avec le nouveau mot de passe.",
    reset: "Réinitialiser le mot de passe", resetting: "Réinitialisation…", invalidPassword: "Choisissez un mot de passe de 12 à 256 caractères.",
    mismatch: "Les mots de passe ne correspondent pas.", resetError: "Impossible de réinitialiser le mot de passe. Veuillez réessayer dans un instant.",
    rateLimit: "Trop de tentatives de réinitialisation. Patientez avant de réessayer.", retryIn: "Réessayez dans", seconds: "secondes",
    unavailable: "La récupération du mot de passe est indisponible. Veuillez réessayer plus tard.",
    successTitle: "Mot de passe réinitialisé.", success: "Votre nouveau mot de passe est prêt. Toutes les sessions administrateur ont été déconnectées.",
    signIn: "Se connecter avec le nouveau mot de passe", backLogin: "Retour à la connexion administrateur", backStore: "Retour à la boutique",
    protected: "Récupération protégée · Vérification du propriétaire requise",
  },
  ar: {
    language: "اللغة", security: "استعادة الحساب", title: "بداية جديدة.",
    description: "استعد الوصول إلى متجرك بكلمة مرور جديدة للمسؤول.",
    loading: "جارٍ التحقق من صلاحية الاستعادة…", sessionError: "تعذر التحقق من صلاحية استعادة الحساب.", retry: "إعادة المحاولة",
    verify: "تابع بحساب ChatGPT الخاص بالمالك الأصلي لهذا المتجر للتحقق من هويتك.",
    chatGPT: "التحقق باستخدام ChatGPT", denied: "هذا الحساب غير مصرح له بإعادة تعيين كلمة مرور المسؤول. استخدم حساب ChatGPT الخاص بمالك المتجر.",
    switchAccount: "استخدام حساب ChatGPT آخر", signedInAs: "المالك الموثّق", newPassword: "كلمة المرور الجديدة", confirmPassword: "تأكيد كلمة المرور الجديدة",
    showPassword: "إظهار كلمة المرور", hidePassword: "إخفاء كلمة المرور", passwordHelp: "استخدم من 12 إلى 256 حرفاً. يُفضّل اختيار عبارة مرور طويلة وفريدة.",
    sessionHelp: "تؤدي إعادة تعيين كلمة المرور إلى إنهاء جميع جلسات المسؤول. سجّل الدخول مجدداً بكلمة المرور الجديدة.",
    reset: "إعادة تعيين كلمة المرور", resetting: "جارٍ إعادة التعيين…", invalidPassword: "اختر كلمة مرور من 12 إلى 256 حرفاً.",
    mismatch: "كلمتا المرور غير متطابقتين.", resetError: "تعذرت إعادة تعيين كلمة المرور. حاول مجدداً بعد قليل.",
    rateLimit: "محاولات إعادة التعيين كثيرة. يُرجى الانتظار قبل المحاولة مجدداً.", retryIn: "يمكنك المحاولة بعد", seconds: "ثانية",
    unavailable: "استعادة كلمة المرور غير متاحة حالياً. حاول مجدداً لاحقاً.",
    successTitle: "تمت إعادة تعيين كلمة المرور.", success: "كلمة المرور الجديدة جاهزة. تم إنهاء جميع جلسات المسؤول.",
    signIn: "الدخول بكلمة المرور الجديدة", backLogin: "العودة إلى تسجيل دخول المسؤول", backStore: "العودة إلى المتجر",
    protected: "استعادة محمية · يلزم التحقق من هوية مالك المتجر",
  },
};

function retryDelay(response: Response, data: { retryAfter?: unknown }): number {
  const bodyDelay = Number(data.retryAfter);
  const header = response.headers.get("Retry-After");
  const headerDelay = header && /^\d+$/.test(header) ? Number(header) : header ? (Date.parse(header) - Date.now()) / 1000 : 0;
  const seconds = Number.isFinite(bodyDelay) && bodyDelay > 0 ? bodyDelay : headerDelay;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

export default function AdminResetPasswordClient({ initialLanguage = "fr" }: { initialLanguage?: Language }) {
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [session, setSession] = useState<RecoverySession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<RecoveryError | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [complete, setComplete] = useState(false);
  const t = words[lang];

  const checkSession = useCallback((signal?: AbortSignal) =>
    fetch("/api/admin/recovery/session", { cache: "no-store", credentials: "same-origin", signal }).then(response => {
      if (!response.ok) throw new Error("Recovery session unavailable");
      return response.json() as Promise<RecoverySession>;
    }).then(nextSession => {
      if (!signal?.aborted) setSession(nextSession);
    }).catch(() => {
      if (!signal?.aborted) setSessionError(true);
    }).finally(() => {
      if (!signal?.aborted) setSessionLoading(false);
    }), []);

  useEffect(() => {
    const controller = new AbortController();
    void checkSession(controller.signal);
    return () => controller.abort();
  }, [checkSession]);

  useEffect(() => {
    if (!retryUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetrySeconds(remaining);
      if (remaining === 0) { setRetryUntil(0); setError(current => current === "rateLimit" ? null : current); }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [retryUntil]);

  function changeLanguage(next: Language) {
    setLang(next);
    document.cookie = `ayoub-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try { window.localStorage.setItem("ayoub-language", next); } catch { /* Language still works without browser storage. */ }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || retrySeconds > 0 || !session?.canReset) return;
    setError(null);
    if (newPassword.length < 12 || newPassword.length > 256) { setError("invalidPassword"); return; }
    if (newPassword !== confirmPassword) { setError("mismatch"); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/recovery", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; retryAfter?: unknown };
      if (response.status === 429) {
        const seconds = retryDelay(response, data);
        setRetrySeconds(seconds);
        setRetryUntil(Date.now() + seconds * 1000);
        setError("rateLimit");
      } else if (response.status === 401 || response.status === 403) {
        setNewPassword("");
        setConfirmPassword("");
        setSession(current => current ? { ...current, authenticated: response.status !== 401, canReset: false } : null);
      } else if (response.status === 400) {
        setError("invalidPassword");
      } else if (response.status === 503) {
        setError("unavailable");
      } else if (!response.ok || !data.ok) {
        setError("resetError");
      } else {
        setNewPassword("");
        setConfirmPassword("");
        setComplete(true);
      }
    } catch {
      setError("resetError");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="adm-auth-shell adm-login-shell adm-recovery-shell" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
    <header className="adm-auth-nav">
      <Link href="/" className="adm-brand" aria-label="Ayoub Shop"><span className="adm-brand-mark"><Watch size={25} strokeWidth={1.45} /></span><span>AYOUB<span className="adm-brand-shop">SHOP</span></span></Link>
      <label className="adm-language"><Globe2 size={15} /><span className="adm-sr-only">{t.language}</span><select value={lang} onChange={event => changeLanguage(event.target.value as Language)}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select><ChevronDown size={12} /></label>
    </header>
    <main className="adm-auth-main">
      <div className="adm-auth-art" aria-hidden="true"><div className="adm-auth-orbit adm-auth-orbit-one" /><div className="adm-auth-orbit adm-auth-orbit-two" /><div className="adm-auth-watch"><KeyRound size={85} strokeWidth={0.7} /></div><span className="adm-auth-orbit-dot" /></div>
      <div className="adm-auth-content">
        <span className="adm-eyebrow"><ShieldCheck size={14} />{t.security}</span>
        <h1>{t.title}</h1><p>{t.description}</p>
        {sessionLoading ? <div className="adm-login-loading" role="status"><LoaderCircle size={20} className="adm-spin" /><span>{t.loading}</span></div> : sessionError ? <div className="adm-login-notice" role="alert"><p>{t.sessionError}</p><button type="button" className="adm-button adm-button-secondary" onClick={() => { setSessionLoading(true); setSessionError(false); void checkSession(); }}><RefreshCw size={15} />{t.retry}</button></div> : complete ? <div className="adm-recovery-success" role="status"><CheckCircle2 size={27} /><h2>{t.successTitle}</h2><p>{t.success}</p><Link href="/admin/login?reset=1" className="adm-button adm-button-primary">{t.signIn}<ArrowUpRight size={16} /></Link></div> : !session?.authenticated ? <div className="adm-recovery-intro"><p>{t.verify}</p><a href="/signin-with-chatgpt?return_to=%2Fadmin%2Freset-password" target="_top" className="adm-button adm-button-secondary"><ShieldCheck size={16} />{t.chatGPT}<ArrowUpRight size={16} /></a></div> : !session.canReset ? <div className="adm-login-notice" role="status"><p>{t.denied}</p><a href="/signout-with-chatgpt?return_to=%2Fadmin%2Freset-password" target="_top" className="adm-text-button"><LogOut size={14} />{t.switchAccount}</a></div> : <form className="adm-login-form" onSubmit={resetPassword} aria-busy={submitting}>
          {session.user && <div className="adm-recovery-account"><span>{t.signedInAs}</span><strong dir={session.user.email ? "ltr" : undefined}>{session.user.email || session.user.displayName}</strong></div>}
          <div className="adm-login-field"><label htmlFor="admin-new-password">{t.newPassword}</label><div className="adm-login-password"><input id="admin-new-password" name="newPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} dir="ltr" minLength={12} maxLength={256} required value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={submitting} aria-invalid={error === "invalidPassword" || error === "mismatch"} aria-describedby={error ? "admin-reset-password-help admin-reset-error" : "admin-reset-password-help"} /><button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? t.hidePassword : t.showPassword} aria-pressed={showPassword} disabled={submitting}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p id="admin-reset-password-help" className="adm-recovery-help">{t.passwordHelp}</p></div>
          <div className="adm-login-field"><label htmlFor="admin-confirm-password">{t.confirmPassword}</label><div className="adm-login-password"><input id="admin-confirm-password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" autoCapitalize="none" spellCheck={false} dir="ltr" minLength={12} maxLength={256} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={submitting} aria-invalid={error === "mismatch"} aria-describedby={error ? "admin-reset-error" : undefined} /><button type="button" onClick={() => setShowConfirmPassword(current => !current)} aria-label={showConfirmPassword ? t.hidePassword : t.showPassword} aria-pressed={showConfirmPassword} disabled={submitting}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <p className="adm-recovery-help">{t.sessionHelp}</p>
          {error && <p id="admin-reset-error" className="adm-login-error" role="alert">{t[error]}</p>}
          <button type="submit" className="adm-button adm-button-primary adm-login-submit" disabled={submitting || retrySeconds > 0}>{submitting ? <LoaderCircle size={17} className="adm-spin" /> : <KeyRound size={17} />}{submitting ? t.resetting : t.reset}</button>
          {retrySeconds > 0 && <p className="adm-login-countdown" role="status" aria-live="off">{t.retryIn} {new Intl.NumberFormat(lang).format(retrySeconds)} {t.seconds}</p>}
        </form>}
        {!complete && <Link href="/admin/login" className="adm-text-button adm-recovery-back"><ArrowLeft size={14} />{t.backLogin}</Link>}
        <span className="adm-auth-note"><ShieldCheck size={13} />{t.protected}</span>
      </div>
    </main>
    <footer className="adm-auth-footer"><span>© {new Date().getFullYear()} Ayoub Shop</span><Link href="/"><ArrowLeft size={13} />{t.backStore}</Link></footer>
  </div>;
}
