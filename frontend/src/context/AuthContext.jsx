import { createContext, useEffect, useMemo, useState } from "react";
import { getMyPermissions } from "../services/permissionService";

export const AuthContext = createContext(null);
const readStoredUser = () => { const stored = localStorage.getItem("user"); if (!stored || stored === "undefined" || stored === "null") { localStorage.removeItem("user"); return null; } try { return JSON.parse(stored); } catch { localStorage.removeItem("user"); return null; } };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(Boolean(user));
  useEffect(() => { let active = true; if (!user) { setPermissions([]); setPermissionsLoading(false); return undefined; } setPermissionsLoading(true); getMyPermissions().then((result) => { if (active) setPermissions(Array.isArray(result?.permissions) ? result.permissions : []); }).catch(() => { if (active) setPermissions([]); }).finally(() => { if (active) setPermissionsLoading(false); }); return () => { active = false; }; }, [user]);
  const login = (data) => { if (!data?.token || !data?.user) throw new Error("Invalid login response"); localStorage.setItem("token", data.token); localStorage.setItem("user", JSON.stringify(data.user)); setUser(data.user); };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setPermissions([]); setUser(null); };
  const value = useMemo(() => ({ user, login, logout, permissions, permissionsLoading, can: (permission) => user?.role === "super_admin" || permissions.includes(permission) }), [user, permissions, permissionsLoading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
