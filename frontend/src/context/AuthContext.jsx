import { createContext, useMemo, useState } from "react";

export const AuthContext = createContext(null);

const readStoredUser = () => {
  const stored = localStorage.getItem("user");

  if (!stored || stored === "undefined" || stored === "null") {
    localStorage.removeItem("user");
    return null;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = (data) => {
    if (!data?.token || !data?.user) {
      throw new Error("Invalid login response");
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const updateSession = (data) => {
    if (data?.token) localStorage.setItem("token", data.token);
    if (data?.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
    }
  };

  const value = useMemo(() => ({ user, login, logout, updateSession }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
