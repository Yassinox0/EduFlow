import { useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import useI18n from "../hooks/useI18n";
import { changeAccountPassword, getAccountProfile, uploadAccountPhoto } from "../services/accountService";
import { getTeacherDashboard } from "../services/teacherPortalService";
import teacherPortalError from "../utils/teacherPortalError";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const photoUrl = (path) => path ? `${API_URL}/${String(path).replace(/^\/+/, "")}` : "";

export default function TeacherProfilePage() {
  const { updateSession } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", new_password_confirmation: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = () => Promise.all([getAccountProfile(), getTeacherDashboard()])
    .then(([account, dashboard]) => setProfile({ ...account, workload: dashboard.workload || {}, assignments: dashboard.assignments || [] }))
    .catch(() => setError(t("teacherPortal.loadError")));
  useEffect(load, [t]);
  const initials = useMemo(() => `${profile?.first_name?.[0] || ""}${profile?.last_name?.[0] || ""}`.toUpperCase(), [profile]);
  const upload = async (event) => { const file = event.target.files?.[0]; if (!file) return; setError(""); try { await uploadAccountPhoto(file); await load(); setMessage(t("teacherAccount.photoSaved")); } catch (requestError) { setError(teacherPortalError(requestError, t, "teacherAccount.photoError")); } event.target.value = ""; };
  const changePassword = async (event) => { event.preventDefault(); setError(""); setMessage(""); try { const result = await changeAccountPassword(passwords); updateSession(result); setPasswords({ current_password: "", new_password: "", new_password_confirmation: "" }); setMessage(t("teacherAccount.passwordSaved")); } catch (requestError) { setError(teacherPortalError(requestError, t, "teacherAccount.passwordError")); } };
  if (!profile) return <section className="panel"><p className={error ? "error-text" : ""}>{error || t("common.loading")}</p></section>;
  return <div className="teacher-portal-page">
    <section className="panel hero-modern"><p className="brand-kicker">{t("teacherPortal.account")}</p><h1>{t("teacherAccount.profileTitle")}</h1><p className="muted">{t("teacherAccount.adminIdentityHelp")}</p></section>
    {error && <section className="panel"><p className="error-text">{error}</p></section>}{message && <section className="panel"><p className="success-text">{message}</p></section>}
    <section className="teacher-profile-grid"><article className="panel teacher-profile-card"><div className="teacher-profile-photo">{profile.photo_path ? <img src={photoUrl(profile.photo_path)} alt="" /> : <span>{initials}</span>}</div><h2>{profile.first_name} {profile.last_name}</h2><p>{profile.email}</p><label className="student-photo-action"><span>{t("teacherAccount.changePhoto")}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label></article>
      <article className="panel"><h2>{t("teacherAccount.identity")}</h2><dl className="detail-list"><div><dt>{t("common.fullName")}</dt><dd>{profile.first_name} {profile.last_name}</dd></div><div><dt>{t("common.phone")}</dt><dd>{profile.phone || "—"}</dd></div><div><dt>{t("common.address")}</dt><dd>{profile.address || "—"}</dd></div><div><dt>{t("common.school")}</dt><dd>{profile.school_name}</dd></div><div><dt>{t("teacherPortal.assignedHours")}</dt><dd>{profile.workload.assigned_hours || 0} h</dd></div><div><dt>{t("teacherPortal.scheduledHours")}</dt><dd>{profile.workload.scheduled_hours || 0} h</dd></div><div><dt>{t("teacherPortal.remainingHours")}</dt><dd>{profile.workload.remaining_hours || 0} h</dd></div></dl><p className="form-help">{t("teacherAccount.contactAdminToEdit")}</p></article>
      <article className="panel teacher-password-panel"><h2>{t("teacherAccount.changePassword")}</h2><form className="form-grid" onSubmit={changePassword}><label>{t("teacherAccount.currentPassword")}</label><input type="password" autoComplete="current-password" required value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /><label>{t("teacherAccount.newPassword")}</label><input type="password" minLength="10" required value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} /><label>{t("teacherAccount.confirmPassword")}</label><input type="password" minLength="10" required value={passwords.new_password_confirmation} onChange={(e) => setPasswords({ ...passwords, new_password_confirmation: e.target.value })} /><button>{t("teacherAccount.savePassword")}</button></form></article>
    </section>
  </div>;
}
