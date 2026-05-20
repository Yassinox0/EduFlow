import { useEffect, useMemo, useState } from "react";
import { getClassLevels } from "../services/classLevelService";
import { createStudent, deleteStudent, getStudents, updateStudent } from "../services/studentService";

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD" }).format(
    Number(value || 0)
  );

const emptyForm = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  parent_name: "",
  parent_phone: "",
  monthly_amount: "",
  discount_percent: "0",
  school_year: "",
  class_level_id: "",
  status: "ACTIVE",
};

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [classLevels, setClassLevels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    const [studentsData, levelsData] = await Promise.all([getStudents(), getClassLevels()]);
    setStudents(Array.isArray(studentsData) ? studentsData : []);
    setClassLevels(Array.isArray(levelsData) ? levelsData : []);
  };

  useEffect(() => {
    loadData().catch(() => setError("Impossible de charger les eleves."));
  }, []);

  const averageMonthlyFee = useMemo(() => {
    if (!students.length) {
      return 0;
    }
    const total = students.reduce((sum, item) => sum + Number(item.monthly_amount || 0), 0);
    return total / students.length;
  }, [students]);

  const effectiveAmountPreview = useMemo(() => {
    const amount = Number(form.monthly_amount || 0);
    const discount = Number(form.discount_percent || 0);
    const net = amount * ((100 - discount) / 100);
    return net > 0 ? net : 0;
  }, [form.discount_percent, form.monthly_amount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const classLevelId = form.class_level_id ? Number(form.class_level_id) : null;
      if (!classLevelId) {
        throw new Error("Veuillez selectionner une classe.");
      }

      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        date_of_birth: form.date_of_birth || null,
        parent_name: form.parent_name.trim(),
        parent_phone: form.parent_phone.trim(),
        monthly_amount: Number(form.monthly_amount || 0),
        discount_percent: Number(form.discount_percent || 0),
        school_year: form.school_year.trim() || null,
        class_level_id: classLevelId,
        status: form.status,
      };

      if (editingId) {
        await updateStudent(editingId, payload);
        setMessage("Eleve modifie avec succes.");
      } else {
        await createStudent(payload);
        setMessage("Eleve cree avec succes.");
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Echec de creation eleve.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student) => {
    setError("");
    setMessage("");

    const matchedLevel =
      classLevels.find((item) => Number(item.id) === Number(student.class_level_id)) ||
      classLevels.find((item) => item.name === (student.class_level_name || student.class_level)) ||
      null;

    setEditingId(student.id);
    setForm({
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      date_of_birth: student.date_of_birth || "",
      parent_name: student.parent_name || "",
      parent_phone: student.parent_phone || student.phone || "",
      monthly_amount: student.monthly_amount != null ? String(student.monthly_amount) : "",
      discount_percent: student.discount_percent != null ? String(student.discount_percent) : "0",
      school_year: student.school_year || "",
      class_level_id: matchedLevel ? String(matchedLevel.id) : "",
      status: student.status || "ACTIVE",
    });
  };

  const handleDelete = async (student) => {
    const confirmed = window.confirm(`Supprimer l'eleve ${student.first_name} ${student.last_name} ?`);
    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    try {
      await deleteStudent(student.id);
      setMessage("Eleve supprime avec succes.");
      if (editingId === student.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de suppression eleve.");
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Eleves</h2>
        <p className="muted">
          Creation et suivi des eleves avec mensualite, reduction et classe.
        </p>
      </section>

      <section className="kpi-grid two-col">
        <article className="panel kpi">
          <p className="kpi-label">Eleves inscrits</p>
          <h2>{students.length}</h2>
          <p className="muted">Dossiers actifs dans la plateforme</p>
        </article>
        <article className="panel kpi">
          <p className="kpi-label">Mensualite moyenne</p>
          <h2>{formatMoney(averageMonthlyFee)}</h2>
          <p className="muted">Moyenne des mensualites configurees</p>
        </article>
      </section>

      <section className="panel">
        <h3>{editingId ? "Modifier un eleve" : "Creer un eleve"}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input
            placeholder="Prenom"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
          />
          <input
            placeholder="Nom"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
          />
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
          <input
            placeholder="Nom du parent"
            value={form.parent_name}
            onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
            required
          />
          <input
            placeholder="Telephone du parent"
            value={form.parent_phone}
            onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
            required
          />
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Montant mensuel"
            value={form.monthly_amount}
            onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })}
            required
          />
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="Reduction (%)"
            value={form.discount_percent}
            onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
          />
          <input
            placeholder="Annee scolaire (ex: 2025-2026)"
            value={form.school_year}
            onChange={(e) => setForm({ ...form, school_year: e.target.value })}
          />
          <select
            value={form.class_level_id}
            onChange={(e) => setForm({ ...form, class_level_id: e.target.value })}
            required
          >
            <option value="">Choisir un niveau existant</option>
            {classLevels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <p className="muted">Si la classe n'existe pas, cree-la d'abord dans le menu Classes.</p>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>
          <p className="muted">Mensualite apres reduction: {formatMoney(effectiveAmountPreview)}</p>
          <button type="submit" disabled={loading}>
            {loading ? (editingId ? "Mise a jour..." : "Creation...") : (editingId ? "Mettre a jour" : "Creer l'eleve")}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
                setError("");
                setMessage("");
              }}
            >
              Annuler modification
            </button>
          )}
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <h3>Liste des eleves</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prenom</th>
                <th>Niveau</th>
                <th>Annee scolaire</th>
                <th>Parent</th>
                <th>Telephone parent</th>
                <th>Mensualite</th>
                <th>Reduction</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.last_name}</td>
                  <td>{student.first_name}</td>
                  <td>{student.class_level_name || student.class_level}</td>
                  <td>{student.school_year || "-"}</td>
                  <td>{student.parent_name}</td>
                  <td>{student.parent_phone || student.phone || "-"}</td>
                  <td>{formatMoney(student.monthly_amount)}</td>
                  <td>{Number(student.discount_percent || 0)}%</td>
                  <td>{student.status === "INACTIVE" ? "Inactif" : "Actif"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ width: "auto", padding: "6px 10px" }}
                        onClick={() => handleEdit(student)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        style={{ width: "auto", padding: "6px 10px" }}
                        onClick={() => handleDelete(student)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="10" className="table-empty">
                    Aucun eleve trouve.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
