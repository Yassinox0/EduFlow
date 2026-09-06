import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useI18n from "../hooks/useI18n";
import { changeAccountPassword } from "../services/accountService";
import teacherPortalError from "../utils/teacherPortalError";

export default function FirstPasswordPage() {
  const { user, updateSession } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return <Navigate to="/" replace />;
  if (!user.must_change_password) return <Navigate to={user.role === "professeur" ? "/teacher/dashboard" : "/dashboard"} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await changeAccountPassword(form);
      updateSession(result);
      navigate(user.role === "professeur" ? "/teacher/dashboard" : "/dashboard", { replace: true });
    } catch (requestError) {
      setError(teacherPortalError(requestError, t, "teacherAccount.passwordError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="account-activation-screen">
      <section className="panel account-activation-card">
        <p className="brand-kicker">{user.school_name}</p>
        <h1>{t("teacherAccount.activationTitle")}</h1>
        <p className="muted">{t("teacherAccount.activationHelp")}</p>
        <form className="form-grid" onSubmit={submit}>
          <label>{t("teacherAccount.currentPassword")}</label>
          <input type={show ? "text" : "password"} autoComplete="current-password" required value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
          <label>{t("teacherAccount.newPassword")}</label>
          <input type={show ? "text" : "password"} autoComplete="new-password" minLength="10" required value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
          <label>{t("teacherAccount.confirmPassword")}</label>
          <input type={show ? "text" : "password"} autoComplete="new-password" minLength="10" required value={form.new_password_confirmation} onChange={(e) => setForm({ ...form, new_password_confirmation: e.target.value })} />
          <label className="inline-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> {t("teacherAccount.showPasswords")}</label>
          <p className="form-help">{t("teacherAccount.passwordRules")}</p>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button disabled={saving}>{saving ? t("common.saving") : t("teacherAccount.activate")}</button>
        </form>
      </section>
    </main>
  );
}
