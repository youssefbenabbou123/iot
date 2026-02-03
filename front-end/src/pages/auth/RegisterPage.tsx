import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../services/api";

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await api.post("/users/add", { email, password });
      if (res.status === 200 || res.status === 201) {
        setSuccess("Compte créé. Tu peux te connecter.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError("Erreur lors de la création.");
      }
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string | unknown } }; message?: string };
      let msg = "Création impossible. Vérifie que la gateway et Signing tournent.";
      if (typeof ex.response?.data?.detail === "string") msg = ex.response.data.detail;
      else if (Array.isArray(ex.response?.data?.detail) && ex.response.data.detail.length > 0) {
        msg = (ex.response.data.detail as { msg?: string }[]).map((x) => x.msg || JSON.stringify(x)).join(" ");
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="glass-panel rounded-2xl max-w-md w-full p-8 space-y-6">
        <h1 className="text-lg font-semibold">Créer un compte <span className="text-primary-300">Monitoring Cloud IoT 2025</span></h1>
        <p className="text-xs text-slate-400">Après inscription, connecte-toi depuis la page Login.</p>
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
          {success && <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/60 rounded-md px-3 py-2">{success}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary-500 hover:bg-primary-400 text-slate-950 font-semibold text-sm py-2.5 transition disabled:opacity-60">
            {loading ? "Création..." : "Créer le compte"}
          </button>
        </form>
        <p className="text-[11px] text-slate-500 text-center">
          Déjà un compte ? <Link to="/login" className="text-primary-300 hover:text-primary-200">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
