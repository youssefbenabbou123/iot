import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "../../state/AuthContext";
import { API_BASE_URL } from "../../services/api";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type MonitoringData = {
  device_id: string;
  temperature?: number;
  humidity?: number;
  cpu?: number;
  memory_percent?: number;
  disk_percent?: number;
  status?: string;
  timestamp: string;
};

type PredictionResult = {
  device_id: string;
  predicted_temperature?: number;
  horizon_seconds?: number;
  method?: string;
  based_on_n_points?: number;
};

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || "http://localhost:3000";
const SOCKET_PATH = "/monitoring/socket.io";
const SOCKET_BASE_URL = import.meta.env.VITE_GATEWAY_URL || (import.meta.env.DEV ? "http://localhost:8080" : window.location.origin);

export function MonitoringPage() {
  const { token } = useAuth();
  const [data, setData] = useState<MonitoringData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState<string>("");
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [useDateRange, setUseDateRange] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [predictDeviceId, setPredictDeviceId] = useState<string>("");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
    instance.interceptors.request.use((c) => {
      if (token) c.headers = { ...c.headers, Authorization: `Bearer ${token}` };
      return c;
    });
    return instance;
  }, [token]);

  const [deviceIds, setDeviceIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ device_id: string }[]>("/devices/")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setDeviceIds(list.map((d) => d.device_id).filter(Boolean));
      })
      .catch(() => { if (!cancelled) setDeviceIds([]); });
    return () => { cancelled = true; };
  }, [api]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (useDateRange && deviceFilter.trim() && dateStart && dateEnd) {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        const res = await api.get<MonitoringData[]>(
          `/monitoring/data/${encodeURIComponent(deviceFilter.trim())}/range?start_time=${start.toISOString()}&end_time=${end.toISOString()}`
        );
        setData(Array.isArray(res.data) ? res.data : []);
      } else if (deviceFilter.trim()) {
        const res = await api.get<MonitoringData[]>(`/monitoring/data/${encodeURIComponent(deviceFilter.trim())}?limit=200`);
        setData(Array.isArray(res.data) ? (res.data as MonitoringData[]).reverse() : []);
      } else {
        const res = await api.get<MonitoringData[]>("/monitoring/data?limit=200");
        setData(Array.isArray(res.data) ? (res.data as MonitoringData[]).reverse() : []);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [api, deviceFilter, useDateRange, dateStart, dateEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = io(SOCKET_BASE_URL, { path: SOCKET_PATH, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    if (socket.connected) setSocketConnected(true);
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("device_data", (doc: unknown) => {
      setSocketConnected(true);
      const d = doc as Record<string, unknown>;
      if (d && typeof d.device_id === "string" && typeof d.timestamp === "string") {
        const row: MonitoringData = {
          device_id: d.device_id,
          temperature: typeof d.temperature === "number" ? d.temperature : undefined,
          humidity: typeof d.humidity === "number" ? d.humidity : undefined,
          cpu: typeof d.cpu === "number" ? d.cpu : undefined,
          memory_percent: typeof d.memory_percent === "number" ? d.memory_percent : undefined,
          disk_percent: typeof d.disk_percent === "number" ? d.disk_percent : undefined,
          status: typeof d.status === "string" ? d.status : undefined,
          timestamp: d.timestamp,
        };
        setData((prev) => [row, ...prev].slice(0, 200));
      }
    });
    const interval = setInterval(() => {
      if (socketRef.current?.connected) setSocketConnected(true);
    }, 1000);
    return () => {
      clearInterval(interval);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, []);

  const fetchPrediction = useCallback(async () => {
    if (!predictDeviceId.trim()) return;
    setPredictionLoading(true);
    setPredictionError(null);
    setPrediction(null);
    try {
      const res = await api.get<PredictionResult>(
        `/monitoring/data/${encodeURIComponent(predictDeviceId.trim())}/predict?horizon_seconds=60&limit=30`
      );
      setPrediction(res.data ?? null);
    } catch {
      setPredictionError("Prédiction indisponible pour ce device.");
      setPrediction(null);
    } finally {
      setPredictionLoading(false);
    }
  }, [api, predictDeviceId]);

  const devices = useMemo(() => {
    const ids = new Set<string>(deviceIds);
    data.forEach((m) => m.device_id && ids.add(m.device_id));
    return Array.from(ids).sort();
  }, [data, deviceIds]);

  const chartData = useMemo(() => {
    return data
      .slice()
      .reverse()
      .map((m) => ({
        time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        date: m.timestamp ? new Date(m.timestamp).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) : "",
        temp: m.temperature ?? 0,
        humidity: m.humidity ?? 0,
        cpu: m.cpu ?? 0,
        ram: m.memory_percent ?? 0,
      }));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold">Monitoring temps réel</h2>
          <p className="text-xs text-slate-400">Flux en direct via Socket.IO (service Monitoring). Chaque mesure IoT est diffusée en temps réel — pas basé sur un simple « dernier relevé ».</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Filtres</h3>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value)}
            className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Tous les devices</option>
            {devices.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={useDateRange}
              onChange={(e) => setUseDateRange(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500"
            />
            Plage de dates (device requis)
          </label>
          {useDateRange && (
            <>
              <input
                type="datetime-local"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100"
              />
              <input
                type="datetime-local"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100"
              />
            </>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="rounded-lg bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-slate-900 font-medium text-sm px-4 py-1.5"
          >
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Prédiction ML (prochaine minute)</h3>
        <p className="text-[11px] text-slate-500 mb-3">Régression linéaire sur les dernières mesures du device pour prédire la température.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={predictDeviceId}
            onChange={(e) => { setPredictDeviceId(e.target.value); setPrediction(null); setPredictionError(null); }}
            className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Choisir un device</option>
            {devices.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchPrediction}
            disabled={predictionLoading || !predictDeviceId.trim()}
            className="rounded-lg bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-slate-900 font-medium text-sm px-4 py-1.5"
          >
            {predictionLoading ? "Calcul…" : "Calculer prédiction"}
          </button>
        </div>
        {predictionError && <p className="text-amber-400/90 text-xs mt-2">{predictionError}</p>}
        {prediction && (
          <div className="mt-3 rounded-lg bg-slate-800/60 p-3 text-sm">
            <div><span className="text-slate-400">Device : </span><span className="font-mono text-slate-200">{prediction.device_id}</span></div>
            <div><span className="text-slate-400">Température prédite : </span><span className="text-primary-300 font-bold">{prediction.predicted_temperature != null ? `${prediction.predicted_temperature.toFixed(1)} °C` : "—"}</span></div>
            {prediction.horizon_seconds != null && <div className="text-[11px] text-slate-500">Horizon {prediction.horizon_seconds} s · {prediction.method ?? ""} {prediction.based_on_n_points != null ? `(${prediction.based_on_n_points} points)` : ""}</div>}
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Température & humidité (temps réel Socket.IO)</h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={Math.max(0, Math.floor(chartData.length / 12))} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" °C" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" %" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  formatter={(value: number, name: string) => [name === "temp" ? `${Number(value).toFixed(1)} °C` : `${Number(value).toFixed(0)} %`, name === "temp" ? "Température" : "Humidité"]}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="temp" name="Température" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidité" stroke="#a78bfa" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(chartData.some((d) => d.cpu > 0 || d.ram > 0)) && (
        <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">CPU / RAM (end-devices)</h3>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={Math.max(0, Math.floor(chartData.length / 10))} />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" %" />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} formatter={(value: number) => [`${Number(value).toFixed(1)} %`, ""]} />
                <Legend />
                <Line type="monotone" dataKey="cpu" name="CPU" stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ram" name="RAM" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm">Chargement...</p>}
      <div className="glass-panel rounded-xl p-4 overflow-x-auto border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Dernières mesures</h3>
        <table className="min-w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
          <thead className="bg-slate-900/80">
            <tr>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Device</th>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Temp.</th>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Humidité</th>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">CPU</th>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">RAM</th>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Disque</th>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Heure</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, idx) => (
              <tr key={`${m.device_id}-${m.timestamp}-${idx}`} className="odd:bg-slate-900/40">
                <td className="px-3 py-2 border-b border-slate-800/60 font-mono">{m.device_id}</td>
                <td className="px-3 py-2 border-b border-slate-800/60">{m.temperature != null ? `${m.temperature.toFixed(1)} °C` : "-"}</td>
                <td className="px-3 py-2 border-b border-slate-800/60">{m.humidity != null ? `${m.humidity.toFixed(0)} %` : "-"}</td>
                <td className="px-3 py-2 border-b border-slate-800/60">{m.cpu != null ? `${m.cpu.toFixed(1)} %` : "-"}</td>
                <td className="px-3 py-2 border-b border-slate-800/60">{m.memory_percent != null ? `${m.memory_percent.toFixed(1)} %` : "-"}</td>
                <td className="px-3 py-2 border-b border-slate-800/60">{m.disk_percent != null ? `${m.disk_percent.toFixed(1)} %` : "-"}</td>
                <td className="px-3 py-2 border-b border-slate-800/60 text-slate-400">{new Date(m.timestamp).toLocaleTimeString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data.length === 0 && (
          <p className="text-slate-500 py-4 text-center">
            {socketConnected ? "Aucune mesure reçue encore. Lancez un simulateur IoT ou un end-device ; les données apparaîtront ici en direct." : "Connectez Socket.IO pour voir le flux en direct."}
          </p>
        )}
      </div>

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Grafana (observabilité — hors monitoring applicatif)</h3>
        <p className="text-[11px] text-slate-500 mb-3">Métriques Prometheus / Node Exporter. Ceci vous renvoie vers Grafana, en complément du monitoring temps réel ci-dessus.</p>
        <a
          href={GRAFANA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 hover:bg-primary-400 text-slate-900 font-medium text-sm px-4 py-2"
        >
          Ouvrir Grafana →
        </a>
      </div>
    </div>
  );
}
