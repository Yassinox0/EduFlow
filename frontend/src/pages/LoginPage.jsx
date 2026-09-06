import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useI18n from "../hooks/useI18n";
import { loginRequest } from "../services/authService";
import { BRAND_NAME, SCHOOL_NAME } from "../config/brand";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginRequest(form);
      login(data);
      if (data?.user?.must_change_password) {
        navigate("/account/activate");
      } else if (data?.user?.role === "super_admin") {
        navigate("/super-admin/dashboard");
      } else if (data?.user?.role === "professeur") {
        navigate("/teacher/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (requestError) {
      setError(
        requestError?.response
          ? t("errors.invalidCredentials")
          : t("errors.apiUnavailable")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-screen">
      <div className="language-switcher login-language" role="group" aria-label={t("common.languageSelector")}>
        <button type="button" className={language === "fr" ? "active" : ""} aria-pressed={language === "fr"} onClick={() => setLanguage("fr")}>FR</button>
        <button type="button" className={language === "ar" ? "active" : ""} aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>AR</button>
      </div>

      <div className="login-hero" aria-labelledby="login-title">
        <div className="login-brand-lockup">
          <img
            className="login-brand-logo"
            src="/images/onecore.png"
            alt={t("common.logoAlt", { name: BRAND_NAME })}
          />
          <div>
            <p className="login-brand-name">{BRAND_NAME}</p>
            <p className="login-brand-tagline">{t("brand.tagline")}</p>
          </div>
        </div>
        <p className="brand-kicker">{SCHOOL_NAME}</p>
        <h1 id="login-title">{t("login.title")}</h1>
        <p>{t("login.description")}</p>
        <div className="login-features">
          <span className="login-feature">{t("login.featureStudents")}</span>
          <span className="login-feature">{t("login.featureTeaching")}</span>
          <span className="login-feature">{t("login.featureFinance")}</span>
        </div>
      </div>

      <div className="login-card">
        <h2>{t("login.cardTitle")}</h2>
        <p className="muted login-subtitle">{t("login.cardSubtitle")}</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="login-email">{t("login.email")}</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder={t("login.emailPlaceholder")}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <label className="field-label" htmlFor="login-password">{t("login.password")}</label>
          <div className="password-field">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("login.password")}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              aria-pressed={showPassword}
              title={showPassword ? t("login.hidePassword") : t("login.showPassword")}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a16.8 16.8 0 01-2.2 2.7M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5a10.7 10.7 0 004.1-.8" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>
              )}
            </button>
          </div>
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
        {error && <p className="error-text login-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
