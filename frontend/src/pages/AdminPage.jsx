import { useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import useI18n from "../hooks/useI18n";
import { createUser, deleteUser, getUsers, resetUserPassword, updateUser } from "../services/userService";
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

export default function AdminPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [currentSchool, setCurrentSchool] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [error, setError] = useState("");

  const isEditing = editingId !== null;

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
    load().catch(() => setError(t("administration.loadError")));
  }, [isAdmin, isSuperAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        status: form.status,
      };

      if (!isEditing) {
        payload.email_local_part = form.email_local_part;
        payload.password = form.password;
      } else if (form.password) {
        payload.password = form.password;
      }

      if (isSuperAdmin) {
        payload.role = form.role;
        if (form.role !== "super_admin") {
          payload.school_id = Number(form.school_id);
        }
      } else {
        payload.role = form.role;
      }

      if (isEditing) {
        await updateUser(editingId, payload);
        setMessage(t("administration.updated"));
      } else {
        const created = await createUser(payload);
        setMessage(t("administration.created", { email: created.email }));
      }

      setEditingId(null);
      setForm((prev) => ({ ...EMPTY_FORM, school_id: prev.school_id || form.school_id }));
      await load();
    } catch (err) {
      setError(t("administration.saveError"));
    }
  };

  const handleEdit = (targetUser) => {
    setEditingId(targetUser.id);
    setForm({
      first_name: targetUser.first_name || "",
      last_name: targetUser.last_name || "",
      email_local_part: "",
      password: "",
      role: targetUser.role || "user",
      school_id: targetUser.school_id ? String(targetUser.school_id) : "",
      status: targetUser.status || "ACTIVE",
    });
    setMessage("");
    setResetMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm((prev) => ({ ...EMPTY_FORM, school_id: prev.school_id || form.school_id }));
  };

  const handleDelete = async (targetUser) => {
    if (!window.confirm(t("administration.confirmDelete", { email: targetUser.email }))) {
      return;
    }

    setError("");
    setMessage("");
    setResetMessage("");

    try {
      await deleteUser(targetUser.id);
      setMessage(t("administration.deleted"));
      if (editingId === targetUser.id) {
        cancelEdit();
      }
      await load();
    } catch (err) {
      setError(t("administration.deleteError"));
    }
  };

  const handleResetPassword = async (targetUser) => {
    setError("");
    setMessage("");
    setResetMessage("");

    try {
      const result = await resetUserPassword(targetUser.id);
      setResetMessage(t("administration.passwordReset", { email: result.email, password: result.default_password }));
    } catch (err) {
      setError(t("administration.resetError"));
    }
  };

  if (!isSuperAdmin && !isAdmin) {
    return (
      <section className="panel">
        <h2>{t("administration.title")}</h2>
        <p className="muted">{t("administration.accessDenied")}</p>
      </section>
    );
  }

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">{t("administration.title")}</p>
        <h2>{isSuperAdmin ? t("administration.globalDirectory") : t("administration.schoolDirectory")}</h2>
        <p className="muted">
          {isSuperAdmin
            ? t("administration.globalDescription")
            : t("administration.schoolDescription")}
        </p>
      </section>

      <section className="panel">
        <h3>{isEditing ? t("administration.editUser") : t("administration.createUser")}</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input placeholder={t("common.firstName")} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input placeholder={t("common.lastName")} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />

          {isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">{t("roles.user")}</option>
              <option value="professeur">{t("roles.professeur")}</option>
              <option value="admin">{t("roles.admin")}</option>
              <option value="super_admin">{t("roles.super_admin")}</option>
            </select>
          )}

          {!isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">{t("roles.user")}</option>
              <option value="professeur">{t("roles.professeur")}</option>
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

          {!isEditing && (
            <input
              placeholder={t("administration.emailPrefix")}
              value={form.email_local_part}
              onChange={(e) => setForm({ ...form, email_local_part: e.target.value })}
            />
          )}
          {!isEditing && form.role !== "super_admin" && (
            <p className="muted">{t("administration.emailPreview", { email: (form.email_local_part || "user") + "@" + emailDomain })}</p>
          )}

          <input
            type="password"
            placeholder={isEditing ? t("administration.newPasswordOptional") : t("common.password")}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!isEditing}
          />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">{t("statuses.active")}</option>
            <option value="INACTIVE">{t("statuses.inactive")}</option>
          </select>
          <div className="form-actions">
            <button type="submit">{isEditing ? t("common.save") : t("administration.createUser")}</button>
            {isEditing && (
              <button type="button" className="secondary-btn" onClick={cancelEdit}>
                {t("common.cancel")}
              </button>
            )}
          </div>
        </form>
        {message && <p className="muted">{message}</p>}
        {resetMessage && <p className="muted">{resetMessage}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <h3>{t("administration.usersCount", { count: users.length })}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("common.id")}</th>
                <th>{t("common.fullName")}</th>
                <th>{t("common.email")}</th>
                <th>{t("common.role")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.school")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item, index) => {
                const canEdit = isSuperAdmin || (isAdmin && ["user", "professeur"].includes(item.role));
                const canDelete = isSuperAdmin && item.id !== user?.id;

                return (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.first_name} {item.last_name}</td>
                    <td>{item.email}</td>
                    <td>{t(`roles.${item.role}`)}</td>
                    <td>{item.status === "ACTIVE" ? t("statuses.active") : t("statuses.inactive")}</td>
                    <td>{item.school_name || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => handleEdit(item)}
                          disabled={!canEdit}
                        >
                          {t("common.edit")}
                        </button>
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => handleResetPassword(item)}
                            disabled={item.role === "super_admin"}
                          >
                            {t("administration.resetPassword")}
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            type="button"
                            className="danger-btn"
                            onClick={() => handleDelete(item)}
                            disabled={!canDelete}
                          >
                            {t("common.delete")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length && (
                <tr>
                  <td colSpan="7" className="table-empty">{t("administration.empty")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
