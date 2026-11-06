"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown, Eye, EyeOff, Globe2, LoaderCircle, LockKeyhole, LogOut, RefreshCw, ShieldCheck, Watch } from "lucide-react";

type Language = "en" | "fr" | "ar";
type Session = {
  authenticated: boolean;
  isAdmin: boolean;
  user: { email?: string; displayName?: string } | null;
  authMethod?: "password" | "chatgpt";
  passwordLoginAvailable?: boolean;
};

const words = {
  en: {
    language: "Language", security: "Secure administration", title: "Behind the details.",
    description: "Sign in to manage your collection, care for your customers, and keep your store moving.",
    email: "Administrator email", password: "Password", showPassword: "Show password", hidePassword: "Hide password",
    signIn: "Sign in", signingIn: "Signing in…", chatGPT: "Continue with ChatGPT", alternative: "Or use your authorized account",
    protected: "Protected access · Authorized team members only", backStore: "Back to the store", loading: "Checking your access…",
    sessionError: "We couldn’t verify your access.", retry: "Try again", invalidCredentials: "The email or password is incorrect.",
    loginError: "We couldn’t sign you in. Please try again shortly.", rateLimit: "Too many sign-in attempts. Please wait before trying again.",
    retryIn: "Try again in", seconds: "seconds", unavailable: "Password sign-in is currently unavailable. Use an authorized ChatGPT account or contact the store administrator.",
    denied: "This account does not have administrator access.", signedInAs: "Signed in as", signOut: "Sign out of ChatGPT", opening: "Opening your workspace…",
  },
  fr: {
    language: "Langue", security: "Administration sécurisée", title: "Le sens du détail.",
    description: "Connectez-vous pour gérer votre collection, prendre soin de vos clients et faire vivre votre boutique.",
    email: "E-mail administrateur", password: "Mot de passe", showPassword: "Afficher le mot de passe", hidePassword: "Masquer le mot de passe",
    signIn: "Se connecter", signingIn: "Connexion…", chatGPT: "Continuer avec ChatGPT", alternative: "Ou utilisez votre compte autorisé",
    protected: "Accès protégé · Équipe autorisée uniquement", backStore: "Retour à la boutique", loading: "Vérification de votre accès…",
    sessionError: "Impossible de vérifier votre accès.", retry: "Réessayer", invalidCredentials: "L’e-mail ou le mot de passe est incorrect.",
    loginError: "Connexion impossible. Veuillez réessayer dans un instant.", rateLimit: "Trop de tentatives de connexion. Patientez avant de réessayer.",
    retryIn: "Réessayez dans", seconds: "secondes", unavailable: "La connexion par mot de passe est indisponible. Utilisez un compte ChatGPT autorisé ou contactez l’administrateur de la boutique.",
    denied: "Ce compte n’a pas accès à l’administration.", signedInAs: "Connecté en tant que", signOut: "Se déconnecter de ChatGPT", opening: "Ouverture de votre espace…",
  },
  ar: {
    language: "اللغة", security: "إدارة آمنة", title: "وراء كل تفصيل.",
    description: "سجّل الدخول لإدارة مجموعتك والعناية بعملائك ومتابعة متجرك.",
    email: "البريد الإلكتروني للمسؤول", password: "كلمة المرور", showPassword: "إظهار كلمة المرور", hidePassword: "إخفاء كلمة المرور",
    signIn: "تسجيل الدخول", signingIn: "جارٍ تسجيل الدخول…", chatGPT: "المتابعة باستخدام ChatGPT", alternative: "أو استخدم حسابك المصرح له",
    protected: "وصول محمي · للمسؤولين المصرح لهم فقط", backStore: "العودة إلى المتجر", loading: "جارٍ التحقق من صلاحية الدخول…",
    sessionError: "تعذر التحقق من صلاحية الدخول.", retry: "إعادة المحاولة", invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    loginError: "تعذر تسجيل الدخول. حاول مجدداً بعد قليل.", rateLimit: "محاولات تسجيل الدخول كثيرة. يُرجى الانتظار قبل إعادة المحاولة.",
    retryIn: "يمكنك المحاولة بعد", seconds: "ثانية", unavailable: "تسجيل الدخول بكلمة المرور غير متاح حالياً. استخدم حساب ChatGPT مصرحاً له أو تواصل مع مسؤول المتجر.",
    denied: "هذا الحساب غير مصرح له بإدارة المتجر.", signedInAs: "تم تسجيل الدخول باسم", signOut: "تسجيل الخروج من ChatGPT", opening: "جارٍ فتح مساحة متجرك…",
  },
};

function retryDelay(response: Response, data: { retryAfter?: unknown }): number {
  const bodyDelay = Number(data.retryAfter);
  const header = response.headers.get("Retry-After");
  const headerDelay = header && /^\d+$/.test(header) ? Number(header) : header ? (Date.parse(header) - Date.now()) / 1000 : 0;
  const seconds = Number.isFinite(bodyDelay) && bodyDelay > 0 ? bodyDelay : headerDelay;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

export default function AdminLoginClient({ initialLanguage = "en" }: { initialLanguage?: Language }) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<"invalidCredentials" | "loginError" | "rateLimit" | "unavailable" | null>(null);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const t = words[lang];

  const checkSession = useCallback((signal?: AbortSignal) =>
    fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin", signal }).then(response => {
      if (!response.ok) throw new Error("Session unavailable");
      return response.json() as Promise<Session>;
    }).then(nextSession => {
      if (signal?.aborted) return;
      setSession(nextSession);
      if (nextSession.isAdmin) router.replace("/admin");
    }).catch(() => {
      if (!signal?.aborted) setSessionError(true);
    }).finally(() => {
      if (!signal?.aborted) setSessionLoading(false);
    }), [router]);

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

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || retrySeconds > 0 || !session?.passwordLoginAvailable) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({})) as Session & { retryAfter?: unknown };
      if (response.status === 429) {
        const seconds = retryDelay(response, data);
        setRetrySeconds(seconds);
        setRetryUntil(Date.now() + seconds * 1000);
        setError("rateLimit");
      } else if (response.status === 401 || response.status === 403) {
        setPassword("");
        setError("invalidCredentials");
      } else if (response.status === 503) {
        setError("unavailable");
      } else if (!response.ok || !data.isAdmin) {
        setError("loginError");
      } else {
        setPassword("");
        setSession(data);
        router.replace("/admin");
        router.refresh();
      }
    } catch {
      setError("loginError");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="adm-auth-shell adm-login-shell" lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
    <header className="adm-auth-nav">
      <Link href="/" className="adm-brand" aria-label="Ayoub Shop"><span className="adm-brand-mark"><Watch size={25} strokeWidth={1.45} /></span><span>AYOUB<span className="adm-brand-shop">SHOP</span></span></Link>
      <label className="adm-language"><Globe2 size={15} /><span className="adm-sr-only">{t.language}</span><select value={lang} onChange={event => changeLanguage(event.target.value as Language)}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select><ChevronDown size={12} /></label>
    </header>
    <main className="adm-auth-main">
      <div className="adm-auth-art" aria-hidden="true"><div className="adm-auth-orbit adm-auth-orbit-one" /><div className="adm-auth-orbit adm-auth-orbit-two" /><div className="adm-auth-watch"><Watch size={100} strokeWidth={0.65} /></div><span className="adm-auth-orbit-dot" /></div>
      <div className="adm-auth-content">
        <span className="adm-eyebrow"><ShieldCheck size={14} />{t.security}</span>
        <h1>{t.title}</h1><p>{t.description}</p>
        {sessionLoading || session?.isAdmin ? <div className="adm-login-loading" role="status"><LoaderCircle size={20} className="adm-spin" /><span>{session?.isAdmin ? t.opening : t.loading}</span></div> : sessionError ? <div className="adm-login-notice" role="alert"><p>{t.sessionError}</p><button type="button" className="adm-button adm-button-secondary" onClick={() => { setSessionLoading(true); setSessionError(false); void checkSession(); }}><RefreshCw size={15} />{t.retry}</button></div> : <>
          {!session?.passwordLoginAvailable && session?.authenticated && !session.isAdmin && <div className="adm-login-notice" role="status"><p>{t.denied}</p>{session.user?.email && <div className="adm-auth-account"><span>{t.signedInAs}</span><strong dir="ltr">{session.user.email}</strong></div>}<a className="adm-text-button" href="/signout-with-chatgpt?return_to=%2Fadmin%2Flogin" target="_top"><LogOut size={14} />{t.signOut}</a></div>}
          {session?.passwordLoginAvailable ? <form className="adm-login-form" onSubmit={signIn} aria-busy={submitting}>
            <label className="adm-login-field" htmlFor="admin-email"><span>{t.email}</span><input id="admin-email" name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={submitting} aria-invalid={error === "invalidCredentials"} aria-describedby={error ? "admin-login-error" : undefined} /></label>
            <div className="adm-login-field"><label htmlFor="admin-password">{t.password}</label><div className="adm-login-password"><input id="admin-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" spellCheck={false} dir="ltr" maxLength={256} required value={password} onChange={event => setPassword(event.target.value)} disabled={submitting} aria-invalid={error === "invalidCredentials"} aria-describedby={error ? "admin-login-error" : undefined} /><button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? t.hidePassword : t.showPassword} aria-pressed={showPassword} disabled={submitting}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            {error && <p id="admin-login-error" className="adm-login-error" role="alert">{t[error]}</p>}
            <button type="submit" className="adm-button adm-button-primary adm-login-submit" disabled={submitting || retrySeconds > 0}>{submitting ? <LoaderCircle size={17} className="adm-spin" /> : <LockKeyhole size={17} />}{submitting ? t.signingIn : t.signIn}</button>
            {retrySeconds > 0 && <p className="adm-login-countdown" role="status" aria-live="off">{t.retryIn} {new Intl.NumberFormat(lang).format(retrySeconds)} {t.seconds}</p>}
          </form> : <div className="adm-login-notice" role="status"><p>{t.unavailable}</p></div>}
          {!session?.passwordLoginAvailable && <div className="adm-login-alternative"><span>{t.alternative}</span><a href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top" className="adm-button adm-button-secondary"><LockKeyhole size={16} />{t.chatGPT}<ArrowUpRight size={16} /></a></div>}
          <span className="adm-auth-note"><ShieldCheck size={13} />{t.protected}</span>
        </>}
      </div>
    </main>
    <footer className="adm-auth-footer"><span>© {new Date().getFullYear()} Ayoub Shop</span><Link href="/"><ArrowLeft size={13} />{t.backStore}</Link></footer>
  </div>;
}
