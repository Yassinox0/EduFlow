import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createUser } from "../services/userService";
import {
  createSchool,
  getSchools,
  uploadSchoolLogo,
} from "../services/schoolService";

const EMPTY_SCHOOL_FORM = {
  name: "",
  code: "",
  slug: "",
  email_domain: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  primary_color: "#1E3A8A",
  secondary_color: "#22C55E",
  currency: "MAD",
  status: "ACTIVE",
};

const EMPTY_USER_FORM = {
  first_name: "",
  last_name: "",
  email_local_part: "",
  password: "",
  role: "admin",
  school_id: "",
  status: "ACTIVE",
};

export default function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL_FORM);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSchool = useMemo(
    () => schools.find((item) => String(item.id) === String(userForm.school_id)) || null,
    [schools, userForm.school_id]
  );

  const emailDomain = selectedSchool?.email_domain || "school-domain.com";

  const loadSchools = async () => {
    const data = await getSchools();
    const safe = Array.isArray(data) ? data : [];
    setSchools(safe);

    if (!userForm.school_id && safe.length > 0) {
      setUserForm((prev) => ({ ...prev, school_id: String(safe[0].id) }));
    }
  };

  useEffect(() => {
    loadSchools().catch(() => setError("Unable to load schools."));
  }, []);

  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      let logo_path = "";
      if (logoFile) {
        const upload = await uploadSchoolLogo(logoFile);
        logo_path = upload.logo_path || "";
      }

      const created = await createSchool({ ...schoolForm, logo_path });
      setMessage(`School created: ${created.name}`);
      setSchoolForm(EMPTY_SCHOOL_FORM);
      setLogoFile(null);
      await loadSchools();
      setUserForm((prev) => ({ ...prev, school_id: String(created.id) }));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create school.");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        first_name: userForm.first_name,
        last_name: userForm.last_name,
        email_local_part: userForm.email_local_part,
        password: userForm.password,
        role: userForm.role,
        school_id: Number(userForm.school_id),
        status: userForm.status,
      };

      const created = await createUser(payload);
      setMessage(`User created: ${created.email}`);
      setUserForm((prev) => ({ ...EMPTY_USER_FORM, school_id: prev.school_id, role: prev.role }));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create user.");
    }
  };

  return (
    <div className="admin-grid">
      <section className="panel hero-panel">
        <p className="brand-kicker">School Management</p>
        <h2>Schools and Access Setup</h2>
        <p className="muted">Create a school, then assign users and roles in one seamless flow.</p>
      </section>

      <section className="panel">
        <h3>Step 1: Create School</h3>
        <form className="form-grid" onSubmit={handleCreateSchool}>
          <input placeholder="School name" value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} required />
          <input placeholder="School code" value={schoolForm.code} onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })} required />
          <input placeholder="Slug (optional)" value={schoolForm.slug} onChange={(e) => setSchoolForm({ ...schoolForm, slug: e.target.value })} />
          <input placeholder="Email domain" value={schoolForm.email_domain} onChange={(e) => setSchoolForm({ ...schoolForm, email_domain: e.target.value })} required />
          <input placeholder="Phone" value={schoolForm.phone} onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })} />
          <input placeholder="Address" value={schoolForm.address} onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })} />
          <input placeholder="City" value={schoolForm.city} onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })} />
          <input placeholder="Country" value={schoolForm.country} onChange={(e) => setSchoolForm({ ...schoolForm, country: e.target.value })} />
          <select value={schoolForm.status} onChange={(e) => setSchoolForm({ ...schoolForm, status: e.target.value })}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <input type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
          <button type="submit">Create school</button>
        </form>
      </section>

      <section className="panel">
        <h3>Step 2: Create User</h3>
        <form className="form-grid" onSubmit={handleCreateUser}>
          <select value={userForm.school_id} onChange={(e) => setUserForm({ ...userForm, school_id: e.target.value })} required>
            <option value="" disabled>Select school</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>{school.name} ({school.email_domain})</option>
            ))}
          </select>

          <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
            <option value="admin">admin</option>
            <option value="user">user</option>
            <option value="consultant">consultant</option>
          </select>

          <input placeholder="First name" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} required />
          <input placeholder="Last name" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} required />
          <input placeholder="Email local part (ex: salma.alaoui)" value={userForm.email_local_part} onChange={(e) => setUserForm({ ...userForm, email_local_part: e.target.value })} />
          <p className="muted">Email preview: {(userForm.email_local_part || "first.last") + "@" + emailDomain}</p>
          <input type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
          <select value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>

          <button type="submit">Create user</button>
        </form>
      </section>

      {message && (
        <section className="panel">
          <p className="muted">{message}</p>
        </section>
      )}

      {error && (
        <section className="panel">
          <p className="error-text">{error}</p>
        </section>
      )}

      <section className="panel">
        <h3>School list</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Name</th><th>Code</th><th>Domain</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id}>
                  <td>{school.id}</td>
                  <td>{school.name}</td>
                  <td>{school.code}</td>
                  <td>{school.email_domain}</td>
                  <td>{school.status}</td>
                  <td><Link to={`/super-admin/schools/${school.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
