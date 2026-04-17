import { useEffect, useMemo, useState } from "react";
import useAuth from "../hooks/useAuth";
import { createUser, getUsers } from "../services/userService";
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
  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin";

  const [users, setUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [currentSchool, setCurrentSchool] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState("");
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
    load().catch(() => setError("Unable to load admin data."));
  }, [isAdmin, isSuperAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

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
        payload.role = form.role;
      }

      const created = await createUser(payload);
      setMessage(`User created: ${created.email}`);
      setForm((prev) => ({ ...EMPTY_FORM, school_id: prev.school_id || form.school_id }));
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create user.");
    }
  };

  if (!isSuperAdmin && !isAdmin) {
    return (
      <section className="panel">
        <h2>Administration</h2>
        <p className="muted">Access restricted to authorized administrators.</p>
      </section>
    );
  }

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">Administration</p>
        <h2>{isSuperAdmin ? "Global User Directory" : "School User Directory"}</h2>
        <p className="muted">
          {isSuperAdmin
            ? "Create and manage users across schools with controlled role assignment."
            : "Create and manage users for your school only."}
        </p>
      </section>

      <section className="panel">
        <h3>Create user</h3>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
          <input placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />

          {isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">user</option>
              <option value="consultant">consultant</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </select>
          )}

          {!isSuperAdmin && (
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">user</option>
              <option value="consultant">consultant</option>
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
            placeholder="Email local part (ex: salma.alaoui)"
            value={form.email_local_part}
            onChange={(e) => setForm({ ...form, email_local_part: e.target.value })}
          />
          {form.role !== "super_admin" && (
            <p className="muted">Email preview: {(form.email_local_part || "user") + "@" + emailDomain}</p>
          )}

          <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <button type="submit">Create user</button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="panel">
        <h3>Users ({users.length})</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>School</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.first_name} {item.last_name}</td>
                  <td>{item.email}</td>
                  <td>{item.role}</td>
                  <td>{item.status}</td>
                  <td>{item.school_name || "-"}</td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan="6" className="table-empty">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
