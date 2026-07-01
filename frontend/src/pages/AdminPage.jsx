import { useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import { createUser, getUsers, resetUserPassword, updateUser } from "../services/userService";
import { getCurrentSchool, getSchools } from "../services/schoolService";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email_local_part: "",
  password: "",
  role: "user",
  school_id: "",
  status: "ACTIVE",
};

const EMPTY_EDIT_FORM = {
  first_name: "",
  last_name: "",
  role: "user",
  status: "ACTIVE",
  password: "",
};

const roleLabel = {
  user: "Utilisateur",
  admin: "Admin",
  super_admin: "Super admin",
};

export default function AdminPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [currentSchool, setCurrentSchool] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [message, setMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSchool = useMemo(
    () => schools.find((item) => String(item.id) === String(form.school_id)) || null,
    [schools, form.school_id]
  );

  const emailDomain = useMemo(() => {
    if (isSuperAdmin) {
      return selectedSchool?.email_domain || "school-domain.com";
    }
    return currentSchool?.email_domain || "school-domain.com";
  }, [currentSchool?.email_domain, isSuperAdmin, selectedSchool?.email_domain]);

  const canEditUser = (target) => {
    if (isSuperAdmin) {
      return true;
    }

    if (!isAdmin || target.role !== "user") {
      return false;
    }

    return String(target.school_id) === String(user?.school_id);
  };

  const load = async () => {
    const [usersData, currentData] = await Promise.all([
      getUsers(),
      isAdmin ? getCurrentSchool() : Promise.resolve(null),
    ]);

    setUsers(Array.isArray(usersData) ? usersData : []);
    setCurrentSchool(currentData);

    if (isSuperAdmin) {
      const schoolsData = await getSchools();
      const safeSchools = Array.isArray(schoolsData) ? schoolsData : [];
      setSchools(safeSchools);
      if (safeSchools.length && !form.school_id) {
        setForm((prev) => ({ ...prev, school_id: String(safeSchools[0].id) }));
      }
    }
  };

  useEffect(() => {
    load().catch(() => setError("Impossible de charger les donnees d'administration."));
  }, [isAdmin, isSuperAdmin]);

  const clearFeedback = () => {
    setMessage("");
    setResetMessage("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFeedback();

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email_local_part: form.email_local_part,
        password: form.password,
        status: form.status,
      };

      if (isSuperAdmin) {
        payload.role = form.role;
        if (form.role !== "super_admin") {
          payload.school_id = Number(form.school_id);
        }
      } else {
        payload.role = "user";
      }

      const created = await createUser(payload);
      setMessage(`Utilisateur cree: ${created.email}`);
      setForm((prev) => ({ ...EMPTY_FORM, school_id: prev.school_id || form.school_id }));
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de creation utilisateur.");
    }
  };

  const startEdit = (targetUser) => {
    clearFeedback();
    setEditingUserId(targetUser.id);
    setEditForm({
      first_name: targetUser.first_name,
      last_name: targetUser.last_name,
      role: targetUser.role,
      status: targetUser.status,
      password: "",
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    clearFeedback();

    try {
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        status: editForm.status,
      };

      if (isSuperAdmin) {
        payload.role = editForm.role;
      }

      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }

      const updated = await updateUser(editingUserId, payload);
      setMessage(`Utilisateur mis a jour: ${updated.email}`);
      cancelEdit();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de mise a jour utilisateur.");
    }
  };

  const handleResetPassword = async (targetUser) => {
    clearFeedback();

    try {
      const result = await resetUserPassword(targetUser.id);
      setResetMessage(`Mot de passe reinitialise pour ${result.email}: ${result.default_password}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Echec de reinitialisation du mot de passe.");
    }
  };

  const showActionsColumn = isSuperAdmin || isAdmin;

  if (!isSuperAdmin && !isAdmin) {
    return (
      <section className="panel">
        <h2>Administration</h2>
        <p className="muted">Acces reserve aux administrateurs autorises.</p>
      </section>
    );
  }

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Administration</p>
        <h2>{isSuperAdmin ? "Annuaire global des utilisateurs" : "Annuaire de votre ecole"}</h2>
        <p className="muted">
          {isSuperAdmin
            ? "Creation et gestion des comptes multi-ecoles avec controle des roles."
            : "Gestion des comptes utilisateurs de votre ecole uniquement."}
        </p>
      </section>

      <section className="panel">
        <h3>Creer un utilisateur</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input placeholder="Prenom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input placeholder="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />

          {isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">Utilisateur</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super admin</option>
            </select>
          )}

          {isSuperAdmin && form.role !== "super_admin" && (
            <select value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })} required>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.email_domain})
                </option>
              ))}
            </select>
          )}

          <input
            placeholder="Prefixe email (ex: salma.alaoui)"
            value={form.email_local_part}
            onChange={(e) => setForm({ ...form, email_local_part: e.target.value })}
          />
          {(isAdmin || form.role !== "super_admin") && (
            <p className="muted">Apercu email: {(form.email_local_part || "user") + "@" + emailDomain}</p>
          )}

          <input type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>
          <div className="toolbar-actions" style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="action-btn">Creer l'utilisateur</button>
          </div>
        </form>
        {message && <p className="muted">{message}</p>}
        {resetMessage && <p className="muted">{resetMessage}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      {editingUserId && (
        <section className="panel">
          <h3>Modifier l'utilisateur #{editingUserId}</h3>
          <form className="form-grid" onSubmit={handleUpdate}>
            <input
              placeholder="Prenom"
              value={editForm.first_name}
              onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
              required
            />
            <input
              placeholder="Nom"
              value={editForm.last_name}
              onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
              required
            />

            {isSuperAdmin && (
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="user">Utilisateur</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
            )}

            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
            </select>

            <input
              type="password"
              placeholder="Nouveau mot de passe (optionnel)"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />

            <div className="toolbar-actions" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="action-btn">Enregistrer</button>
              <button type="button" className="action-btn secondary-btn" onClick={cancelEdit}>
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <h3>Utilisateurs ({users.length})</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom complet</th>
                <th>Email</th>
                <th>Role</th>
                <th>Statut</th>
                <th>Ecole</th>
                {showActionsColumn && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.first_name} {item.last_name}</td>
                  <td>{item.email}</td>
                  <td>{roleLabel[item.role] || item.role}</td>
                  <td>{item.status === "ACTIVE" ? <span className="status-pill active">Actif</span> : <span className="status-pill inactive">Inactif</span>}</td>
                  <td>{item.school_name || "-"}</td>
                  {showActionsColumn && (
                    <td>
                      <div className="table-actions">
                        {canEditUser(item) && (
                          <button type="button" className="action-btn" onClick={() => startEdit(item)}>
                            Modifier
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            className="action-btn secondary-btn"
                            onClick={() => handleResetPassword(item)}
                            disabled={item.role === "super_admin"}
                          >
                            Reset MDP
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={showActionsColumn ? 7 : 6} className="table-empty">Aucun utilisateur trouve.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
