import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ChartBarIcon,
  CloudIcon,
  CpuChipIcon,
  DeviceTabletIcon,
  PowerIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../state/AuthContext";

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || "http://localhost:3000";

const navItems = [
  { to: "/", label: "Dashboard", icon: ChartBarIcon },
  { to: "/devices", label: "Devices", icon: DeviceTabletIcon },
  { to: "/monitoring", label: "Monitoring", icon: CpuChipIcon },
  { to: "/weather", label: "Météo", icon: CloudIcon },
];

export function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 hidden md:flex flex-col border-r border-slate-800 bg-slate-950/80">
        <div className="px-6 py-5 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500 flex items-center justify-center text-slate-950 font-bold">
              MC
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wide">
                Monitoring Cloud IoT
              </div>
              <div className="text-xs text-slate-400">Edition 2025</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-500/15 text-primary-200 border border-primary-500/60"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                  ].join(" ")
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <a
            href={GRAFANA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
          >
            <Squares2X2Icon className="h-5 w-5" />
            <span>Grafana</span>
          </a>
        </nav>
        <button
          onClick={handleLogout}
          className="m-3 mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-900/80 border border-slate-700 hover:bg-slate-800"
        >
          <PowerIcon className="h-4 w-4" />
          Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center px-4 md:px-6 justify-between">
          <div className="md:hidden font-semibold text-sm">
            Monitoring Cloud IoT 2025
          </div>
          <div className="text-xs md:text-sm text-slate-400">
            Connected to{" "}
            <span className="text-primary-300">Signing / Devices / Monitoring</span>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <div className="max-w-6xl mx-auto space-y-4">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
