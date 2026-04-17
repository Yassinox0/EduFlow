import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { loginRequest } from "../services/authService";
import { BRAND_NAME, SCHOOL_NAME } from "../config/brand";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginRequest(form);
      login(data);
      if (data?.user?.role === "super_admin") {
        navigate("/super-admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Invalid credentials or API is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-screen">
      <div className="login-hero">
        <p className="brand-kicker">{BRAND_NAME}</p>
        <h1>{SCHOOL_NAME} Financial Management</h1>
        <p>
          Secure access to billing, collection tracking, and operational
          oversight in a single unified platform.
        </p>
      </div>

      <div className="login-card">
        <h2>Sign in</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    </section>
  );
}
