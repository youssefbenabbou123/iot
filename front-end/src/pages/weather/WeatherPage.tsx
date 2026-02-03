import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useAuth } from "../../state/AuthContext";
import { API_BASE_URL } from "../../services/api";
import axios from "axios";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type WeatherData = {
  temperature?: number;
  humidity?: number;
  description?: string;
  city?: string;
  updated_at?: string;
  pressure?: number | null;
  wind_speed?: number | null;
  wind_direction?: number | null;
  precipitation?: number | null;
};

type CitySuggestion = { name: string; country?: string; latitude: number; longitude: number };

type ForecastDay = {
  date: string;
  temp_min?: number | null;
  temp_max?: number | null;
  description?: string;
  precipitation_sum?: number | null;
  wind_speed_max?: number | null;
};

type ForecastNextHour = { time?: string; temperature?: number | null; description?: string };

type ForecastData = {
  city?: string;
  daily?: ForecastDay[];
  hourly_24?: { time?: string; temperature?: number | null }[];
  next_hour?: ForecastNextHour | null;
};

type SensorSample = { device_id?: string; temperature?: number | null; humidity?: number | null; timestamp?: string };

type WeatherAnalysisDevice = {
  device_id: string;
  avg_temp: number;
  deviation: number;
  is_anomaly: boolean;
  mean_abs_error: number;
  sample_count: number;
};

type WeatherAnalysisData = {
  city?: string | null;
  weather_temp?: number | null;
  weather_humidity?: number | null;
  devices: WeatherAnalysisDevice[];
  anomaly_threshold_celsius?: number;
};

type WeatherAwarePrediction = {
  device_id: string;
  city?: string;
  device_prediction?: number | null;
  weather_next_hour?: number | null;
  weather_aware_prediction?: number | null;
  blend_factor?: number;
  horizon_seconds?: number;
  anomaly_corrected?: boolean;
  prediction_bounded_by_weather?: boolean;
  raw_prediction_before_bound?: number | null;
};

type Prediction24hHour = { time?: string; our_model_temp?: number; weather_temp?: number | null; blended_temp?: number };

type Prediction24hData = {
  city?: string;
  device_id?: string;
  hourly?: Prediction24hHour[];
  method?: string;
  blend_factor?: number;
  based_on_n_points?: number;
};

const SEARCH_DEBOUNCE_MS = 350;
const OPEN_METEO_GEOCODING = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";

function windDirectionLabel(degrees: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  const idx = Math.round(((degrees % 360) / 22.5)) % 16;
  return dirs[idx] ?? "—";
}

function weatherCodeToDescription(code: number): string {
  const codes: Record<number, string> = {
    0: "Ciel dégagé", 1: "Principalement dégagé", 2: "Partiellement nuageux", 3: "Nuageux",
    45: "Brouillard", 48: "Brouillard givrant", 51: "Bruine légère", 61: "Pluie légère",
    71: "Neige légère", 80: "Averses de pluie", 95: "Orage",
  };
  return codes[code] ?? `Code ${code}`;
}

async function fetchCitiesOpenMeteo(query: string, count: number = 10): Promise<CitySuggestion[]> {
  const url = `${OPEN_METEO_GEOCODING}?name=${encodeURIComponent(query)}&count=${count}&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const results = data?.results ?? [];
  return results
    .filter((x: { name?: unknown; latitude?: unknown; longitude?: unknown }) => x?.name != null && typeof x.latitude === "number" && typeof x.longitude === "number")
    .map((x: { name: string; country?: string; latitude: number; longitude: number }) => ({ name: x.name, country: x.country, latitude: x.latitude, longitude: x.longitude }));
}

async function fetchWeatherOpenMeteo(lat: number, lon: number, city: string): Promise<WeatherData | null> {
  const url = `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const cur = data?.current;
  if (!cur) return null;
  return {
    temperature: cur.temperature_2m ?? null,
    humidity: cur.relative_humidity_2m ?? null,
    description: weatherCodeToDescription(Number(cur.weather_code ?? 0)),
    city,
    updated_at: new Date().toISOString(),
    pressure: cur.surface_pressure != null ? Number(cur.surface_pressure) : null,
    wind_speed: cur.wind_speed_10m != null ? Number(cur.wind_speed_10m) : null,
    wind_direction: cur.wind_direction_10m != null ? Number(cur.wind_direction_10m) : null,
    precipitation: cur.precipitation != null ? Number(cur.precipitation) : null,
  };
}

export function WeatherPage() {
  const { token } = useAuth();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [cityQuery, setCityQuery] = useState("Paris");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>({ name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 });
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [sensorsData, setSensorsData] = useState<SensorSample[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);

  const [analysisData, setAnalysisData] = useState<WeatherAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [weatherAwareDeviceId, setWeatherAwareDeviceId] = useState<string>("");
  const [weatherAwareResult, setWeatherAwareResult] = useState<WeatherAwarePrediction | null>(null);
  const [weatherAwareLoading, setWeatherAwareLoading] = useState(false);
  const [weatherAwareError, setWeatherAwareError] = useState<string | null>(null);

  const [prediction24hDeviceId, setPrediction24hDeviceId] = useState<string>("");
  const [prediction24hData, setPrediction24hData] = useState<Prediction24hData | null>(null);
  const [prediction24hLoading, setPrediction24hLoading] = useState(false);
  const [prediction24hError, setPrediction24hError] = useState<string | null>(null);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
    instance.interceptors.request.use((config) => {
      if (token) config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      return config;
    });
    return instance;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const current = selectedCity;
      if (!current) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<WeatherData>(`/monitoring/weather/current?lat=${current.latitude}&lon=${current.longitude}&city=${encodeURIComponent(current.name)}`);
        let data = res.data;
        const missingEnriched = data?.pressure == null && data?.wind_speed == null && data?.precipitation == null;
        if (!cancelled && data && missingEnriched) {
          try {
            const enriched = await fetchWeatherOpenMeteo(current.latitude, current.longitude, current.name);
            if (enriched) data = { ...data, pressure: enriched.pressure, wind_speed: enriched.wind_speed, wind_direction: enriched.wind_direction, precipitation: enriched.precipitation };
          } catch { /* keep data */ }
        }
        if (!cancelled) setWeather(data);
      } catch {
        try {
          const fallback = await fetchWeatherOpenMeteo(current.latitude, current.longitude, current.name);
          if (!cancelled && fallback) setWeather(fallback);
          else if (!cancelled) setError("Météo non disponible. Vérifiez votre connexion.");
        } catch {
          if (!cancelled) setError("Météo non disponible. Vérifiez que le service Monitoring est configuré.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [api, retryCount, selectedCity]);

  useEffect(() => {
    let cancelled = false;
    const current = selectedCity;
    if (!current) { setForecastData(null); setForecastError(null); return; }
    setForecastLoading(true);
    setForecastError(null);
    api.get<ForecastData>(`/monitoring/weather/forecast?lat=${current.latitude}&lon=${current.longitude}&city=${encodeURIComponent(current.name)}&days=7`)
      .then((res) => { if (!cancelled) setForecastData(res.data ?? null); })
      .catch(() => { if (!cancelled) { setForecastError("Prévisions indisponibles."); setForecastData(null); } })
      .finally(() => { if (!cancelled) setForecastLoading(false); });
    return () => { cancelled = true; };
  }, [api, selectedCity]);

  useEffect(() => {
    let cancelled = false;
    setSensorsLoading(true);
    api.get<SensorSample[]>("/monitoring/data?limit=10")
      .then((res) => { const list = Array.isArray(res.data) ? res.data : []; if (!cancelled) setSensorsData(list); })
      .catch(() => { if (!cancelled) setSensorsData([]); })
      .finally(() => { if (!cancelled) setSensorsLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    const current = selectedCity;
    if (!current) { setAnalysisData(null); setAnalysisError(null); return; }
    setAnalysisLoading(true);
    setAnalysisError(null);
    api.get<WeatherAnalysisData>(`/monitoring/weather/analysis?lat=${current.latitude}&lon=${current.longitude}&city=${encodeURIComponent(current.name)}&limit_data=100`)
      .then((res) => { if (!cancelled) setAnalysisData(res.data ?? null); })
      .catch(() => { if (!cancelled) { setAnalysisError("Analyse météo indisponible."); setAnalysisData(null); } })
      .finally(() => { if (!cancelled) setAnalysisLoading(false); });
    return () => { cancelled = true; };
  }, [api, selectedCity]);

  const fetchWeatherAwarePrediction = useCallback(() => {
    const current = selectedCity;
    if (!current || !weatherAwareDeviceId.trim()) return;
    setWeatherAwareLoading(true);
    setWeatherAwareError(null);
    setWeatherAwareResult(null);
    api.get<WeatherAwarePrediction>(`/monitoring/data/${encodeURIComponent(weatherAwareDeviceId.trim())}/predict-weather-aware?lat=${current.latitude}&lon=${current.longitude}&city=${encodeURIComponent(current.name)}&horizon_seconds=3600&blend_factor=0.6`)
      .then((res) => setWeatherAwareResult(res.data ?? null))
      .catch(() => { setWeatherAwareError("Prédiction weather-aware indisponible."); setWeatherAwareResult(null); })
      .finally(() => setWeatherAwareLoading(false));
  }, [api, selectedCity, weatherAwareDeviceId]);

  const fetchPrediction24h = useCallback(() => {
    const current = selectedCity;
    if (!current || !prediction24hDeviceId.trim()) return;
    setPrediction24hLoading(true);
    setPrediction24hError(null);
    setPrediction24hData(null);
    api.get<Prediction24hData>(`/monitoring/weather/prediction-24h?lat=${current.latitude}&lon=${current.longitude}&city=${encodeURIComponent(current.name)}&device_id=${encodeURIComponent(prediction24hDeviceId.trim())}&blend_factor=0.5`)
      .then((res) => setPrediction24hData(res.data ?? null))
      .catch(() => { setPrediction24hError("Prédiction 24h indisponible."); setPrediction24hData(null); })
      .finally(() => setPrediction24hLoading(false));
  }, [api, selectedCity, prediction24hDeviceId]);

  const selectCity = useCallback((c: CitySuggestion) => {
    setSelectedCity(c);
    setCityQuery(c.name);
    setCitySuggestions([]);
    setSuggestionsOpen(false);
    setRetryCount((r) => r + 1);
  }, []);

  function normalizeSuggestions(data: unknown): CitySuggestion[] {
    if (Array.isArray(data)) {
      return data.filter((x): x is CitySuggestion => x != null && typeof x === "object" && typeof (x as CitySuggestion).name === "string" && typeof (x as CitySuggestion).latitude === "number" && typeof (x as CitySuggestion).longitude === "number")
        .map((x) => ({ name: x.name, country: x.country, latitude: x.latitude, longitude: x.longitude }));
    }
    if (data && typeof data === "object" && "results" in data && Array.isArray((data as { results: unknown }).results)) {
      return normalizeSuggestions((data as { results: unknown }).results);
    }
    return [];
  }

  const fetchSuggestions = useCallback((value: string) => {
    if (!value.trim()) { setCitySuggestions([]); setSuggestionsOpen(false); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    api.get<unknown>(`/monitoring/weather/search-city?q=${encodeURIComponent(value.trim())}&count=10`)
      .then((res) => {
        const list = normalizeSuggestions(res.data);
        setCitySuggestions(list);
        setSuggestionsOpen(list.length > 0);
        setSearchError(list.length === 0 ? `Aucune ville trouvée pour « ${value.trim()} »` : null);
      })
      .catch(async () => {
        try {
          const list = await fetchCitiesOpenMeteo(value.trim(), 10);
          setCitySuggestions(list);
          setSuggestionsOpen(list.length > 0);
          setSearchError(list.length === 0 ? `Aucune ville trouvée pour « ${value.trim()} »` : null);
        } catch {
          setCitySuggestions([]);
          setSuggestionsOpen(false);
          setSearchError("Recherche indisponible.");
        }
      })
      .finally(() => setSearching(false));
  }, [api]);

  const onInputChange = useCallback((value: string) => {
    setCityQuery(value);
    setError(null);
    setSearchError(null);
    if (searchTimeoutRef.current) { clearTimeout(searchTimeoutRef.current); searchTimeoutRef.current = null; }
    if (!value.trim()) { setCitySuggestions([]); setSuggestionsOpen(false); return; }
    searchTimeoutRef.current = setTimeout(() => { searchTimeoutRef.current = null; fetchSuggestions(value); }, SEARCH_DEBOUNCE_MS);
  }, [fetchSuggestions]);

  const searchAndSelectFirst = useCallback(() => {
    const q = cityQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    api.get<unknown>(`/monitoring/weather/search-city?q=${encodeURIComponent(q)}&count=10`)
      .then((res) => {
        const list = normalizeSuggestions(res.data);
        if (list.length > 0) selectCity(list[0]);
        else setSearchError(`Aucune ville trouvée pour « ${q} »`);
      })
      .catch(async () => {
        try {
          const list = await fetchCitiesOpenMeteo(q, 10);
          if (list.length > 0) selectCity(list[0]);
          else setSearchError(`Aucune ville trouvée pour « ${q} »`);
        } catch { setSearchError("Recherche indisponible."); }
      })
      .finally(() => setSearching(false));
  }, [api, cityQuery, selectCity]);

  useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Météo</h2>
        <p className="text-xs text-slate-400">Données météo (Open-Meteo) pour corrélation avec les capteurs IoT.</p>
      </div>

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80 text-sm space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400">Ville suivie :</span>
          <input
            value={cityQuery}
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={() => citySuggestions.length > 0 && setSuggestionsOpen(true)}
            onBlur={() => setTimeout(() => setSuggestionsOpen(false), 220)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (citySuggestions.length > 0) selectCity(citySuggestions[0]); else searchAndSelectFirst(); } }}
            className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[220px]"
            placeholder="Rechercher une ville (ex: Fès, Paris, Rabat...)"
          />
          <button type="button" onClick={searchAndSelectFirst} disabled={searching || !cityQuery.trim()} className="rounded-lg bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:pointer-events-none text-slate-900 font-medium text-sm px-4 py-1.5">
            {searching ? "Recherche…" : "Rechercher"}
          </button>
          {selectedCity && <span className="text-[11px] text-slate-500">Ville : <span className="text-slate-200">{selectedCity.name}{selectedCity.country ? `, ${selectedCity.country}` : ""}</span></span>}
        </div>
        {searchError && <p className="text-amber-400/90 text-xs">{searchError}</p>}
        {suggestionsOpen && citySuggestions.length > 0 && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/95 text-xs z-[100] relative shadow-lg">
            {citySuggestions.map((c, idx) => (
              <button key={`${c.name}-${c.latitude}-${c.longitude}-${idx}`} type="button" onMouseDown={(e) => { e.preventDefault(); selectCity(c); }} className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 flex justify-between gap-2">
                <span className="text-slate-100">{c.name}{c.country ? `, ${c.country}` : ""}</span>
                <span className="text-slate-500">{c.latitude.toFixed(2)}, {c.longitude.toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200 flex items-center justify-between gap-3 flex-wrap">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryCount((c) => c + 1)} className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-slate-900 text-xs font-medium">Réessayer</button>
        </div>
      )}

      <div className="glass-panel rounded-xl p-6 border border-slate-800/80">
        {loading ? <p className="text-slate-400 animate-pulse">Chargement de la météo...</p> : weather ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-lg bg-slate-800/60 p-4"><div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Ville</div><div className="text-lg font-semibold">{weather.city ?? "—"}</div></div>
              <div className="rounded-lg bg-slate-800/60 p-4"><div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Température</div><div className="text-2xl font-bold text-primary-300">{weather.temperature != null ? `${weather.temperature.toFixed(1)} °C` : "—"}</div></div>
              <div className="rounded-lg bg-slate-800/60 p-4"><div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Humidité</div><div className="text-2xl font-bold text-primary-300">{weather.humidity != null ? `${weather.humidity.toFixed(0)} %` : "—"}</div></div>
              <div className="rounded-lg bg-slate-800/60 p-4"><div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pression</div><div className="text-xl font-bold text-sky-300">{weather.pressure != null ? `${weather.pressure.toFixed(0)} hPa` : "—"}</div></div>
              <div className="rounded-lg bg-slate-800/60 p-4"><div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Vent</div><div className="text-xl font-bold text-emerald-300">{weather.wind_speed != null ? `${weather.wind_speed.toFixed(1)} km/h` : "—"}{weather.wind_direction != null && <span className="text-slate-400 font-normal text-sm ml-1" title={`${weather.wind_direction}°`}>{windDirectionLabel(weather.wind_direction)}</span>}</div></div>
              <div className="rounded-lg bg-slate-800/60 p-4"><div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Précipitations</div><div className="text-xl font-bold text-blue-300">{weather.precipitation != null ? `${weather.precipitation.toFixed(1)} mm` : "0 mm"}</div><div className="text-[10px] text-slate-500 mt-0.5">{weather.precipitation != null && weather.precipitation > 0 ? "Cumul heure en cours" : "Pas de pluie (heure en cours)"}</div></div>
            </div>
            {weather.description && <div className="text-sm text-slate-300">{weather.description}</div>}
            {weather.updated_at && <div className="text-[11px] text-slate-500">Dernière mise à jour : {new Date(weather.updated_at).toLocaleString()}</div>}
          </div>
        ) : <p className="text-slate-500">Aucune donnée météo.</p>}
      </div>

      {selectedCity && (
        <>
          {forecastLoading && <p className="text-slate-400 animate-pulse text-sm">Chargement des prévisions...</p>}
          {forecastError && !forecastLoading && <p className="text-amber-400/90 text-sm">{forecastError}</p>}
          {forecastData && !forecastLoading && (
            <div className="space-y-6">
              {forecastData.next_hour && (
                <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Prédiction (prochaine heure)</h3>
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className="text-primary-300 font-bold">{forecastData.next_hour.temperature != null ? `${forecastData.next_hour.temperature.toFixed(1)} °C` : "—"}</span>
                    {forecastData.next_hour.description && <span className="text-slate-400 text-sm">{forecastData.next_hour.description}</span>}
                    {forecastData.next_hour.time && <span className="text-[11px] text-slate-500">{new Date(forecastData.next_hour.time).toLocaleString()}</span>}
                  </div>
                </div>
              )}

              {forecastData.daily && forecastData.daily.length > 0 && (
                <>
                  <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Prévisions 7 jours</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                      {forecastData.daily.map((d, i) => (
                        <div key={d.date ?? i} className="rounded-lg bg-slate-800/60 p-3 text-center">
                          <div className="text-[11px] text-slate-500">{d.date ? new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) : "—"}</div>
                          <div className="text-sm font-semibold text-primary-300">{d.temp_max != null ? `${d.temp_max.toFixed(0)}°` : "—"}{d.temp_min != null && <span className="text-slate-500 font-normal"> / {d.temp_min.toFixed(0)}°</span>}</div>
                          {d.precipitation_sum != null && d.precipitation_sum > 0 && <div className="text-[10px] text-blue-300">🌧 {d.precipitation_sum.toFixed(1)} mm</div>}
                          {d.wind_speed_max != null && d.wind_speed_max > 0 && <div className="text-[10px] text-emerald-400">💨 {d.wind_speed_max.toFixed(0)} km/h</div>}
                          {d.description && <div className="text-[10px] text-slate-400 truncate" title={d.description}>{d.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Températures sur 7 jours</h3>
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forecastData.daily.map((d) => ({ date: d.date ? new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" }) : "", min: d.temp_min ?? 0, max: d.temp_max ?? 0 }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" °C" />
                          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} labelStyle={{ color: "#94a3b8" }} formatter={(value: number) => [`${Number(value).toFixed(1)} °C`, ""]} />
                          <Legend />
                          <Line type="monotone" dataKey="max" name="Max" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="min" name="Min" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Précipitations sur 7 jours</h3>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={forecastData.daily.map((d) => ({ date: d.date ? new Date(d.date).toLocaleDateString("fr-FR", { weekday: "short" }) : "", précipitations: d.precipitation_sum ?? 0, vent_max: d.wind_speed_max ?? 0 }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                          <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" mm" />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" km/h" />
                          <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} formatter={(value: number, name: string) => [name === "précipitations" ? `${Number(value).toFixed(1)} mm` : `${Number(value).toFixed(0)} km/h`, name === "précipitations" ? "Précipitations" : "Vent max"]} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="précipitations" name="Précipitations (mm)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" dataKey="vent_max" name="Vent max (km/h)" fill="#34d399" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Prédiction 24h (notre modèle + météo)</h3>
            <p className="text-[11px] text-slate-500 mb-3">Modèle ML entraîné sur les dernières mesures du capteur, blendé avec la prévision Open-Meteo.</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select value={prediction24hDeviceId} onChange={(e) => { setPrediction24hDeviceId(e.target.value); setPrediction24hData(null); setPrediction24hError(null); }} className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500">
                <option value="">Choisir un capteur</option>
                {analysisData?.devices?.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}
                {(!analysisData?.devices?.length) && [...new Set(sensorsData.map((s) => s.device_id).filter(Boolean))].map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <button type="button" onClick={fetchPrediction24h} disabled={prediction24hLoading || !prediction24hDeviceId.trim()} className="rounded-lg bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-slate-900 font-medium text-sm px-4 py-1.5">{prediction24hLoading ? "Calcul..." : "Calculer"}</button>
            </div>
            {prediction24hError && <p className="text-amber-400/90 text-xs mb-2">{prediction24hError}</p>}
            {prediction24hData?.hourly && prediction24hData.hourly.length > 0 && (
              <>
                {prediction24hData.based_on_n_points != null && <p className="text-[11px] text-slate-500 mb-2">Modèle sur {prediction24hData.based_on_n_points} points · blend {Math.round((prediction24hData.blend_factor ?? 0.5) * 100)}% notre modèle</p>}
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={prediction24hData.hourly.map((h) => ({ time: h.time ? new Date(h.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "", date: h.time ? new Date(h.time).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }) : "", blend: h.blended_temp ?? 0, our: h.our_model_temp ?? 0, weather: h.weather_temp ?? 0 }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#94a3b8" interval={3} />
                      <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" unit=" °C" />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""} formatter={(value: number) => [`${Number(value).toFixed(1)} °C`, ""]} />
                      <Legend />
                      <Line type="monotone" dataKey="blend" name="Prédiction (notre modèle + météo)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="our" name="Notre modèle (capteur)" stroke="#818cf8" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="weather" name="Météo Open-Meteo" stroke="#64748b" strokeWidth={1} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

          {analysisLoading && <p className="text-slate-400 animate-pulse text-sm">Chargement de l&apos;analyse météo ↔ capteurs...</p>}
          {analysisError && !analysisLoading && <p className="text-amber-400/90 text-sm">{analysisError}</p>}
          {analysisData && !analysisLoading && (
            <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
              <h3 className="text-sm font-semibold text-slate-300 mb-1">Analyse météo ↔ capteurs (anomalies)</h3>
              <p className="text-[11px] text-slate-500 mb-3">Météo {analysisData.city ?? "—"} : {analysisData.weather_temp != null ? `${analysisData.weather_temp} °C` : "—"}{analysisData.anomaly_threshold_celsius != null && <span> · Écart &gt; {analysisData.anomaly_threshold_celsius} °C = anomalie</span>}</p>
              {analysisData.devices.length === 0 ? <p className="text-slate-500 text-sm">Aucun device avec température.</p> : (
                <div className="space-y-3">
                  {analysisData.devices.map((d) => (
                    <div key={d.device_id} className={`rounded-lg p-3 text-sm ${d.is_anomaly ? "bg-amber-950/40 border border-amber-700/50" : "bg-slate-800/60"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-200">{d.device_id}</span>
                        {d.is_anomaly && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-600/80 text-slate-900">Anomalie</span>}
                        <span className="text-slate-400">moy. capteur {d.avg_temp} °C · écart {d.deviation >= 0 ? "+" : ""}{d.deviation} °C</span>
                        <span className="text-[11px] text-slate-500">écart moyen {d.mean_abs_error} °C ({d.sample_count} mesures)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-300 mb-1">Prédiction weather-aware</h3>
            <p className="text-[11px] text-slate-500 mb-3">Combine prédiction device (ML) + prévision météo (prochaine heure).</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select value={weatherAwareDeviceId} onChange={(e) => { setWeatherAwareDeviceId(e.target.value); setWeatherAwareResult(null); setWeatherAwareError(null); }} className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500">
                <option value="">Choisir un device</option>
                {analysisData?.devices?.map((d) => <option key={d.device_id} value={d.device_id}>{d.device_id}</option>)}
                {(!analysisData?.devices?.length) && [...new Set(sensorsData.map((s) => s.device_id).filter(Boolean))].map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <button type="button" onClick={fetchWeatherAwarePrediction} disabled={weatherAwareLoading || !weatherAwareDeviceId.trim()} className="rounded-lg bg-primary-500 hover:bg-primary-400 disabled:opacity-50 text-slate-900 font-medium text-sm px-4 py-1.5">{weatherAwareLoading ? "Calcul..." : "Calculer"}</button>
            </div>
            {weatherAwareError && <p className="text-amber-400/90 text-xs mb-2">{weatherAwareError}</p>}
            {weatherAwareResult && (
              <div className="rounded-lg bg-slate-800/60 p-3 text-sm space-y-1">
                <div><span className="text-slate-400">Prédiction device (ML) : </span><span className="text-primary-300 font-medium">{weatherAwareResult.device_prediction != null ? `${weatherAwareResult.device_prediction} °C` : "—"}</span>{weatherAwareResult.prediction_bounded_by_weather && <span className="text-[10px] text-emerald-400/90 ml-1">(borné par la météo)</span>}</div>
                <div><span className="text-slate-400">Météo (prochaine heure) : </span><span className="text-primary-300 font-medium">{weatherAwareResult.weather_next_hour != null ? `${weatherAwareResult.weather_next_hour} °C` : "—"}</span></div>
                <div><span className="text-slate-400">Prédiction weather-aware : </span><span className="text-primary-300 font-bold">{weatherAwareResult.weather_aware_prediction != null ? `${weatherAwareResult.weather_aware_prediction} °C` : "—"}</span>{weatherAwareResult.blend_factor != null && <span className="text-[10px] text-slate-500 ml-1">(blend {Math.round(weatherAwareResult.blend_factor * 100)}% device)</span>}</div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Corrélation avec les capteurs IoT</h3>
        <p className="text-[11px] text-slate-500 mb-3">Dernières températures des devices.</p>
        {sensorsLoading && <p className="text-slate-400 animate-pulse text-xs">Chargement...</p>}
        {!sensorsLoading && sensorsData.length === 0 && <p className="text-slate-500 text-sm">Aucune donnée capteur. Lancez un simulateur IoT.</p>}
        {!sensorsLoading && sensorsData.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {sensorsData.slice(0, 10).map((s, i) => (
              <div key={s.device_id ?? i} className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
                <span className="text-slate-400">{s.device_id ?? `Device ${i + 1}`}</span>
                <span className="ml-1 text-primary-300 font-medium">{s.temperature != null ? `${s.temperature.toFixed(1)} °C` : "—"}</span>
                {s.timestamp && <div className="text-[10px] text-slate-500 truncate">{new Date(s.timestamp).toLocaleTimeString("fr-FR")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
