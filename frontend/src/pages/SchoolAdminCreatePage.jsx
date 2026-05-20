import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createSchoolAdmin } from "../services/schoolService";

export default function SchoolAdminCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      setMessage(`Admin cree: ${created.email}`);
      setTimeout(() => navigate(`/super-admin/schools/${id}`), 1200);
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de creation de l'admin.");
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Admin ecole</p>
        <h2>Creer l'administrateur principal</h2>
      </section>

      <section className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <input placeholder="Prenom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input placeholder="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          <input placeholder="Prefixe email (optionnel)" value={form.email_local_part} onChange={(e) => setForm({ ...form, email_local_part: e.target.value })} />
          <input type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>
          <button type="submit">Creer l'admin de l'ecole</button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>
    </div>
  );
}
