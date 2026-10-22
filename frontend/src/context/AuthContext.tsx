import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { User } from "../api/types";

interface AuthCtx {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(getToken);
  const [user, setUser] = useState<User | null>(null);

  function logout() {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  useEffect(() => {
    if (token) api.get<User>("/auth/me").then(setUser).catch(() => {});
  }, [token]);

  async function login(email: string, password: string) {
    const { access_token } = await api.login(email, password);
    setToken(access_token);
    setTokenState(access_token);
  }

  async function register(email: string, password: string) {
    await api.register(email, password);
    await login(email, password);
  }

  return (
    <Ctx.Provider value={{ token, user, login, register, logout }}>{children}</Ctx.Provider>
  );
}
