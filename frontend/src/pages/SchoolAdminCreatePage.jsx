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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const created = await createSchoolAdmin(id, form);
    setMessage(`Admin created: ${created.email}`);
    setTimeout(() => navigate(`/super-admin/schools/${id}`), 1200);
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">School admin</p>
        <h2>Create principal admin</h2>
      </section>

      <section className="panel">
        <form className="form-grid" onSubmit={handleSubmit}>
          <input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
          <input placeholder="Email local part (optional)" value={form.email_local_part} onChange={(e) => setForm({ ...form, email_local_part: e.target.value })} />
          <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <button type="submit">Create school admin</button>
        </form>
        {message && <p className="muted">{message}</p>}
      </section>
    </div>
  );
}
