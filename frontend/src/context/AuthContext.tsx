import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchDemoUser: (role: UserRole) => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("stocksense_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("stocksense_token"));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyUser = async () => {
      if (token) {
        try {
          const userData = await api.getMe();
          setUser(userData);
          localStorage.setItem("stocksense_user", JSON.stringify(userData));
        } catch {
          setUser(null);
          setToken(null);
          localStorage.removeItem("stocksense_token");
          localStorage.removeItem("stocksense_user");
        }
      }
      setIsLoading(false);
    };

    verifyUser();

    const handleAuthChange = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener("auth-changed", handleAuthChange);
    return () => window.removeEventListener("auth-changed", handleAuthChange);
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const resp = await api.login(email, password);
      setToken(resp.access_token);
      setUser(resp.user);
      localStorage.setItem("stocksense_token", resp.access_token);
      localStorage.setItem("stocksense_user", JSON.stringify(resp.user));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("stocksense_token");
    localStorage.removeItem("stocksense_user");
  };

  const switchDemoUser = async (role: UserRole) => {
    const credentials: Record<UserRole, { email: string; pass: string }> = {
      Admin: { email: "admin@stocksense.io", pass: "adminpassword123" },
      "Inventory Manager": { email: "manager@stocksense.io", pass: "managerpassword123" },
      "Warehouse Worker": { email: "worker@stocksense.io", pass: "workerpassword123" },
      Viewer: { email: "viewer@stocksense.io", pass: "viewerpassword123" },
    };
    const cred = credentials[role];
    if (cred) {
      await login(cred.email, cred.pass);
    }
  };

  const hasRole = (roles: UserRole[]) => {
    if (!user || !user.role) return false;
    return roles.includes(user.role.name);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        switchDemoUser,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
