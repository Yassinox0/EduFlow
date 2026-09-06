import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createSchoolAdmin } from "../services/schoolService";
import useI18n from "../hooks/useI18n";

export default function SchoolAdminCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email_local_part: "",
    password: "",
    status: "ACTIVE",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const created = await createSchoolAdmin(id, form);
      setMessage(t("schoolAdmin.created", { email: created.email }));
      setTimeout(() => navigate(`/super-admin/schools/${id}`), 1200);
    } catch (err) {
      setError(t("schoolAdmin.createError"));
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">{t("schoolAdmin.kicker")}</p>
        <h2>{t("schoolAdmin.title")}</h2>
      </section>

      <section className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <input placeholder={t("common.firstName")} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input placeholder={t("common.lastName")} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          <input placeholder={t("schoolAdmin.emailPrefix")} value={form.email_local_part} onChange={(e) => setForm({ ...form, email_local_part: e.target.value })} />
          <input type="password" placeholder={t("common.password")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">{t("statuses.active")}</option>
            <option value="INACTIVE">{t("statuses.inactive")}</option>
          </select>
          <button type="submit">{t("schoolAdmin.create")}</button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>
    </div>
  );
}
