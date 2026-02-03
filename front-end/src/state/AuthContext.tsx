import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode
} from "react";

type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "monitoring_2025_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login: (t: string) => {
        setToken(t);
        window.localStorage.setItem(TOKEN_KEY, t);
      },
      logout: () => {
        setToken(null);
        window.localStorage.removeItem(TOKEN_KEY);
      }
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

