import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../../state/AuthContext";
import { API_BASE_URL } from "../../services/api";
import axios from "axios";

type Device = {
  id: number;
  device_id: string;
  name: string;
  device_type: string;
  status: string | null;
  location: string | null;
  temperature: number | null;
  created_at: string;
  updated_at?: string;
};

type DeviceForm = {
  device_id: string;
  name: string;
  device_type: string;
  status: string;
  location: string;
  temperature: string;
};

const emptyForm: DeviceForm = {
  device_id: "",
  name: "",
  device_type: "sensor",
  status: "offline",
  location: "",
  temperature: "",
};

export function DevicesPage() {
  const { token } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<DeviceForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeviceForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchId, setSearchId] = useState("");
  const [deviceById, setDeviceById] = useState<Device | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dataForm, setDataForm] = useState({
    device_id: "",
    temperature: "",
    status: "online",
    cpu_percent: "",
    memory_percent: "",
    disk_percent: "",
  });
  const [dataSubmitLoading, setDataSubmitLoading] = useState(false);
  const [dataSubmitError, setDataSubmitError] = useState<string | null>(null);
  const [dataSubmitSuccess, setDataSubmitSuccess] = useState(false);

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
    instance.interceptors.request.use((c) => {
      if (token) c.headers = { ...c.headers, Authorization: `Bearer ${token}` };
      return c;
    });
    return instance;
  }, [token]);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Device[]>("/devices/");
      setDevices(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(typeof ex.response?.data?.detail === "string" ? ex.response.data.detail : "Impossible de charger les devices.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.device_id.trim()) return;
    setError(null);
    setSuccess(null);
    try {
      await api.post("/devices/", {
        device_id: form.device_id.trim(),
        name: form.name.trim() || null,
        device_type: form.device_type.trim() || "sensor",
        status: form.status || "offline",
        location: form.location.trim() || null,
        temperature: form.temperature !== "" && !Number.isNaN(Number(form.temperature)) ? Number(form.temperature) : null,
      });
      setSuccess("Device ajouté.");
      setForm(emptyForm);
      loadDevices();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(typeof ex.response?.data?.detail === "string" ? ex.response.data.detail : "Erreur lors de l'ajout.");
    }
  }, [api, form, loadDevices]);

  const startEdit = useCallback((d: Device) => {
    setEditingId(d.device_id);
    setEditForm({
      device_id: d.device_id,
      name: d.name ?? "",
      device_type: d.device_type ?? "sensor",
      status: d.status ?? "offline",
      location: d.location ?? "",
      temperature: d.temperature != null ? String(d.temperature) : "",
    });
    setError(null);
    setSuccess(null);
  }, []);

  const handleUpdate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    setSuccess(null);
    try {
      await api.put(`/devices/${encodeURIComponent(editingId)}`, {
        device_id: editingId,
        name: editForm.name.trim() || null,
        device_type: editForm.device_type.trim() || "sensor",
        status: editForm.status || "offline",
        location: editForm.location.trim() || null,
        temperature: editForm.temperature !== "" && !Number.isNaN(Number(editForm.temperature)) ? Number(editForm.temperature) : null,
      });
      setSuccess("Device mis à jour.");
      setEditingId(null);
      setEditForm(emptyForm);
      loadDevices();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(typeof ex.response?.data?.detail === "string" ? ex.response.data.detail : "Erreur lors de la mise à jour.");
    }
  }, [api, editingId, editForm, loadDevices]);

  const handleSendDeviceData = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const deviceId = dataForm.device_id.trim();
    if (!deviceId) return;
    setDataSubmitLoading(true);
    setDataSubmitError(null);
    setDataSubmitSuccess(false);
    try {
      const payload: Record<string, string | number> = { device_id: deviceId };
      if (dataForm.temperature !== "" && !Number.isNaN(Number(dataForm.temperature)))
        payload.temperature = Number(dataForm.temperature);
      if (dataForm.status) payload.status = dataForm.status;
      if (dataForm.cpu_percent !== "" && !Number.isNaN(Number(dataForm.cpu_percent)))
        payload.cpu_percent = Number(dataForm.cpu_percent);
      if (dataForm.memory_percent !== "" && !Number.isNaN(Number(dataForm.memory_percent)))
        payload.memory_percent = Number(dataForm.memory_percent);
      if (dataForm.disk_percent !== "" && !Number.isNaN(Number(dataForm.disk_percent)))
        payload.disk_percent = Number(dataForm.disk_percent);
      await api.post(`/devices/${encodeURIComponent(deviceId)}/data`, payload);
      setDataSubmitSuccess(true);
      loadDevices();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } }; message?: string };
      setDataSubmitError(typeof ex.response?.data?.detail === "string" ? ex.response.data.detail : "Erreur lors de l'envoi des données.");
    } finally {
      setDataSubmitLoading(false);
    }
  }, [api, dataForm, loadDevices]);

  const handleGetById = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchId.trim();
    if (!id) return;
    setSearchLoading(true);
    setSearchError(null);
    setDeviceById(null);
    try {
      const res = await api.get<Device>(`/devices/${encodeURIComponent(id)}`);
      setDeviceById(res.data);
    } catch (err: unknown) {
      const ex = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
      if (ex.response?.status === 404) {
        setSearchError("Device non trouvé.");
      } else {
        setSearchError(typeof ex.response?.data?.detail === "string" ? ex.response.data.detail : "Erreur lors de la recherche.");
      }
    } finally {
      setSearchLoading(false);
    }
  }, [api, searchId]);

  const handleDelete = useCallback(async (deviceId: string) => {
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/devices/${encodeURIComponent(deviceId)}`);
      setSuccess("Device supprimé.");
      setDeleteConfirm(null);
      if (editingId === deviceId) setEditingId(null);
      loadDevices();
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(typeof ex.response?.data?.detail === "string" ? ex.response.data.detail : "Erreur lors de la suppression.");
    }
  }, [api, editingId, loadDevices]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Devices</h2>
        <p className="text-xs text-slate-400">Liste des devices (device-management). Ajout, édition et suppression.</p>
      </div>

      {error && <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/60 rounded-md px-3 py-2">{error}</p>}
      {success && <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-700/60 rounded-md px-3 py-2">{success}</p>}

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Ajouter un device</h3>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Device ID *</label>
            <input
              value={form.device_id}
              onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[140px]"
              placeholder="ex: sensor-01"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nom</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]"
              placeholder="Nom"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Type</label>
            <select
              value={form.device_type}
              onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="sensor">sensor</option>
              <option value="actuator">actuator</option>
              <option value="gateway">gateway</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Statut</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="offline">offline</option>
              <option value="online">online</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Localisation</label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]"
              placeholder="ex: Bureau"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Température</label>
            <input
              type="number"
              step="0.1"
              value={form.temperature}
              onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 w-20"
              placeholder="—"
            />
          </div>
          <button type="submit" className="rounded-lg bg-primary-500 hover:bg-primary-400 text-slate-900 font-medium text-sm px-4 py-1.5">Ajouter</button>
        </form>
      </div>

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Rechercher un device par ID</h3>
        <form onSubmit={handleGetById} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Device ID</label>
            <input
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[180px]"
              placeholder="ex: sensor-01"
            />
          </div>
          <button type="submit" disabled={searchLoading || !searchId.trim()} className="rounded-lg bg-primary-500 hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-medium text-sm px-4 py-1.5">
            {searchLoading ? "Recherche..." : "Rechercher"}
          </button>
        </form>
        {searchError && <p className="mt-2 text-xs text-red-400">{searchError}</p>}
        {deviceById && (
          <div className="mt-4 p-4 rounded-lg bg-slate-900/60 border border-slate-700/80">
            <h4 className="text-xs font-semibold text-slate-400 mb-2">Détails du device</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-slate-500">ID (num):</dt><dd className="font-mono text-slate-200">{deviceById.id}</dd>
              <dt className="text-slate-500">Device ID:</dt><dd className="font-mono text-slate-200">{deviceById.device_id}</dd>
              <dt className="text-slate-500">Nom:</dt><dd className="text-slate-200">{deviceById.name ?? "-"}</dd>
              <dt className="text-slate-500">Type:</dt><dd className="text-slate-200">{deviceById.device_type ?? "-"}</dd>
              <dt className="text-slate-500">Statut:</dt><dd className="text-slate-200">{deviceById.status ?? "-"}</dd>
              <dt className="text-slate-500">Localisation:</dt><dd className="text-slate-200">{deviceById.location ?? "-"}</dd>
              <dt className="text-slate-500">Température:</dt><dd className="text-slate-200">{deviceById.temperature != null ? `${deviceById.temperature} °C` : "-"}</dd>
              <dt className="text-slate-500">Créé le:</dt><dd className="text-slate-200">{deviceById.created_at}</dd>
              {deviceById.updated_at && (<><dt className="text-slate-500">Modifié le:</dt><dd className="text-slate-200">{deviceById.updated_at}</dd></>)}
            </dl>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => startEdit(deviceById)} className="text-xs text-primary-300 hover:text-primary-200">Modifier</button>
              <button type="button" onClick={() => { setDeviceById(null); setSearchError(null); setSearchId(""); }} className="text-xs text-slate-400 hover:text-slate-300">Fermer</button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-xl p-4 border border-slate-800/80">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Receive Device Data</h3>
        <p className="text-xs text-slate-500 mb-3">Envoyer des mesures (température, CPU, RAM, disque) vers un device existant. Pas d&apos;auth requise côté IoT.</p>
        <form onSubmit={handleSendDeviceData} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Device ID *</label>
            <input
              value={dataForm.device_id}
              onChange={(e) => setDataForm((f) => ({ ...f, device_id: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[140px]"
              placeholder="ex: sensor-01"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Température</label>
            <input
              type="number"
              step="0.1"
              value={dataForm.temperature}
              onChange={(e) => setDataForm((f) => ({ ...f, temperature: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 w-20"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Statut</label>
            <select
              value={dataForm.status}
              onChange={(e) => setDataForm((f) => ({ ...f, status: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="offline">offline</option>
              <option value="online">online</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">CPU %</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={dataForm.cpu_percent}
              onChange={(e) => setDataForm((f) => ({ ...f, cpu_percent: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 w-16"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">RAM %</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={dataForm.memory_percent}
              onChange={(e) => setDataForm((f) => ({ ...f, memory_percent: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 w-16"
              placeholder="—"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Disque %</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={dataForm.disk_percent}
              onChange={(e) => setDataForm((f) => ({ ...f, disk_percent: e.target.value }))}
              className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 w-16"
              placeholder="—"
            />
          </div>
          <button type="submit" disabled={dataSubmitLoading || !dataForm.device_id.trim()} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm px-4 py-1.5">
            {dataSubmitLoading ? "Envoi..." : "Envoyer les données"}
          </button>
        </form>
        {dataSubmitError && <p className="mt-2 text-xs text-red-400">{dataSubmitError}</p>}
        {dataSubmitSuccess && <p className="mt-2 text-xs text-emerald-400">Données envoyées. Le Monitoring les affiche en temps réel.</p>}
      </div>

      {editingId && (
        <div className="glass-panel rounded-xl p-4 border border-amber-800/60 bg-amber-950/20">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Modifier : {editingId}</h3>
          <form onSubmit={handleUpdate} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nom</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={editForm.device_type}
                onChange={(e) => setEditForm((f) => ({ ...f, device_type: e.target.value }))}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="sensor">sensor</option>
                <option value="actuator">actuator</option>
                <option value="gateway">gateway</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Statut</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="offline">offline</option>
                <option value="online">online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Localisation</label>
              <input
                value={editForm.location}
                onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[120px]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Température</label>
              <input
                type="number"
                step="0.1"
                value={editForm.temperature}
                onChange={(e) => setEditForm((f) => ({ ...f, temperature: e.target.value }))}
                className="rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500 w-20"
              />
            </div>
            <button type="submit" className="rounded-lg bg-primary-500 hover:bg-primary-400 text-slate-900 font-medium text-sm px-4 py-1.5">Enregistrer</button>
            <button type="button" onClick={() => { setEditingId(null); setEditForm(emptyForm); }} className="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-4 py-1.5">Annuler</button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-sm">Chargement...</p>
      ) : (
        <div className="glass-panel rounded-xl p-4 overflow-x-auto border border-slate-800/80">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Liste des devices</h3>
          <table className="min-w-full text-sm border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-900/80">
              <tr>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Device ID</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Nom</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Type</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Status</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Temp.</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Localisation</th>
                <th className="px-3 py-2 text-left font-medium border-b border-slate-800">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="odd:bg-slate-900/40">
                  <td className="px-3 py-2 border-b border-slate-800/60 font-mono">{d.device_id}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{d.name ?? "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{d.device_type ?? "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{d.status ?? "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{d.temperature != null ? `${d.temperature} °C` : "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">{d.location ?? "-"}</td>
                  <td className="px-3 py-2 border-b border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => startEdit(d)} className="text-xs text-primary-300 hover:text-primary-200">Modifier</button>
                      {deleteConfirm === d.device_id ? (
                        <>
                          <span className="text-xs text-slate-500">Supprimer ?</span>
                          <button type="button" onClick={() => handleDelete(d.device_id)} className="text-xs text-red-400 hover:text-red-300">Oui</button>
                          <button type="button" onClick={() => setDeleteConfirm(null)} className="text-xs text-slate-400 hover:text-slate-300">Non</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirm(d.device_id)} className="text-xs text-red-400/90 hover:text-red-300">Supprimer</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {devices.length === 0 && <p className="text-slate-500 py-4 text-center">Aucun device. Ajoutez-en un ci-dessus.</p>}
        </div>
      )}
    </div>
  );
}
