import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../state/AuthContext";
import { API_BASE_URL } from "../../services/api";
import axios from "axios";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Device = { id: number; device_id: string; name: string; status: string | null; location: string | null; temperature: number | null };
type Sample = { device_id: string; temperature?: number; humidity?: number; timestamp: string };

export function DashboardPage() {
  const { token } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
    api.interceptors.request.use((c) => {
      if (token) c.headers = { ...c.headers, Authorization: `Bearer ${token}` };
      return c;
    });
    Promise.all([
      api.get<Device[]>("/devices/").catch(() => ({ data: [] })),
      api.get<Sample[]>("/monitoring/data?limit=50").catch(() => ({ data: [] })),
    ]).then(([dRes, mRes]) => {
      if (!cancelled) {
        setDevices(Array.isArray(dRes.data) ? dRes.data : []);
        const list = Array.isArray(mRes.data) ? mRes.data : [];
        setSamples(list.slice(0, 30).reverse());
      }
    }).catch(() => { if (!cancelled) setError("Impossible de charger le dashboard."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const online = devices.filter((d) => d.status === "online").length;

  const sparklineData = useMemo(() => {
    return samples
      .slice()
      .reverse()
      .map((s, i) => ({
        index: i + 1,
        time: s.timestamp ? new Date(s.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        temp: s.temperature ?? 0,
      }));
  }, [samples]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Vue d&apos;ensemble</h2>
        <p className="text-xs text-slate-400">Résumé Signing, Devices, Monitoring.</p>
      </div>
      {error && <ErrorMessage message={error} onRetry={() => setError(null)} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-panel rounded-xl p-5 border border-slate-800/80">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Devices</div>
          <div className="text-3xl font-bold text-white">{devices.length}</div>
          <Link to="/devices" className="mt-2 inline-block text-xs text-primary-300 hover:text-primary-200">Voir la liste →</Link>
        </div>
        <div className="glass-panel rounded-xl p-5 border border-slate-800/80">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">En ligne</div>
          <div className="text-3xl font-bold text-emerald-400">{online}</div>
        </div>
        <div className="glass-panel rounded-xl p-5 border border-slate-800/80">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Dernières mesures</div>
          <div className="text-3xl font-bold text-primary-300">{samples.length}</div>
          <Link to="/monitoring" className="mt-2 inline-block text-xs text-primary-300 hover:text-primary-200">Monitoring →</Link>
        </div>
      </div>

      {sparklineData.length > 0 && (
        <div className="glass-panel rounded-xl p-5 border border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Tendance température (dernières mesures)</h3>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" °C" width={32} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} formatter={(value: number) => [`${Number(value).toFixed(1)} °C`, "Temp."]} />
                <Line type="monotone" dataKey="temp" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} name="Temp." />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-xl p-5 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Dernières mesures</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Device</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Temp.</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Humidité</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Heure</th>
              </tr>
            </thead>
            <tbody>
              {samples.slice(0, 10).map((s, idx) => (
                <tr key={`${s.device_id}-${s.timestamp}-${idx}`} className="odd:bg-slate-900/40">
                  <td className="px-3 py-2 border-b border-slate-800/60 font-mono">{s.device_id ?? "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{s.temperature != null ? `${s.temperature.toFixed(1)} °C` : "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{s.humidity != null ? `${s.humidity.toFixed(0)} %` : "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60 text-slate-400">{s.timestamp ? new Date(s.timestamp).toLocaleTimeString("fr-FR") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/monitoring" className="mt-2 inline-block text-xs text-primary-300 hover:text-primary-200">Voir tout le monitoring →</Link>
      </div>

      <div className="glass-panel rounded-xl p-5 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Accès rapides</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/devices" className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-sm font-medium border border-slate-700">Devices</Link>
          <Link to="/monitoring" className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-sm font-medium border border-slate-700">Monitoring</Link>
          <Link to="/weather" className="px-4 py-2 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 text-primary-200 text-sm font-medium border border-primary-500/60">Météo</Link>
        </div>
      </div>
      {loading && <p className="text-slate-400 text-sm">Chargement...</p>}
    </div>
  );
}
