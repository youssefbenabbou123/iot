import { Route, Routes, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { DevicesPage } from "./pages/devices/DevicesPage";
import { MonitoringPage } from "./pages/monitoring/MonitoringPage";
import { WeatherPage } from "./pages/weather/WeatherPage";
import { Layout } from "./components/layout/Layout";
import { useAuth } from "./state/AuthContext";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="weather" element={<WeatherPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

