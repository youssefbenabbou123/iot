import { FormEvent, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../state/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("gateway.user@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/users/auth", { email, password });
      const token = res.data?.token;
      if (!token) throw new Error("Token manquant");
      login(token);
      navigate("/");
    } catch (err: unknown) {
      const ex = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      let msg = "Connexion impossible.";
      if (ex.response?.status === 502 || ex.response?.status === 503) {
        msg = "Service indisponible. Lance la gateway (docker compose up -d).";
      } else if (typeof ex.response?.data?.detail === "string") {
        msg = ex.response.data.detail;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="glass-panel rounded-2xl max-w-md w-full p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary-500 flex items-center justify-center text-slate-950 font-bold text-xl">MC</div>
          <div>
            <h1 className="text-lg font-semibold">Monitoring Cloud IoT <span className="text-primary-300">2025</span></h1>
            <p className="text-xs text-slate-400">Authentification (Signing)</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/60 rounded-md px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-500 hover:bg-primary-400 text-slate-950 font-semibold text-sm py-2.5 transition disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
        <p className="text-[11px] text-slate-500 text-center">
          Pas de compte ? <Link to="/register" className="text-primary-300 hover:text-primary-200">Créer un utilisateur</Link>
        </p>
      </div>
    </div>
  );
}
