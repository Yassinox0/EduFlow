import { useEffect, useState } from "react";
import { createClassLevel, getClassLevels } from "../services/classLevelService";

const emptyForm = {
  name: "",
};

export default function ClassesPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const data = await getClassLevels();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch(() => setError("Impossible de charger les classes."));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      await createClassLevel({
        name: form.name.trim(),
      });

      setMessage("Classe creee avec succes.");
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de creation de classe.");
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel">
        <h2>Classes</h2>
        <p className="muted">Creer et gerer les classes avant affectation aux eleves.</p>
      </section>

      <section className="panel">
        <h3>Nouvelle classe</h3>
        <form className="form-grid" onSubmit={submit}>
          <input
            placeholder="Nom (ex: 6eme A)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <button type="submit">Creer la classe</button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <h3>Liste des classes</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Code</th>
                <th>Ordre</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.code || "-"}</td>
                  <td>{item.sort_order}</td>
                  <td>{item.status === "ACTIVE" ? "Actif" : "Inactif"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="5" className="table-empty">
                    Aucune classe trouvee.
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
