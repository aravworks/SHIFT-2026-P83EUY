import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { configured } from "./supabase";
import { AuthProvider, useAuth } from "./auth";
import { FleetProvider } from "./useFleetData";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Alerts } from "./pages/Alerts";
import { Stations } from "./pages/Stations";
import { Vehicles } from "./pages/Vehicles";
import { ApiDocs } from "./pages/ApiDocs";
import { Devices } from "./pages/Devices";

function Gate() {
  const { session, role, loading, signOut } = useAuth();
  if (loading) return <div className="notice">Loading…</div>;
  if (!session) return <Login />;
  if (!role) {
    return (
      <div className="notice">
        <p>This account has no VoltMesh role. Ask an admin to set <code>app_metadata.role</code> to admin, fleet or station.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  }
  const manager = role === "admin" || role === "fleet";
  return (
    <FleetProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="stations" element={<Stations />} />
          <Route path="devices" element={<Devices />} />
          {manager && <Route path="vehicles" element={<Vehicles />} />}
          {manager && <Route path="api" element={<ApiDocs />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FleetProvider>
  );
}

export default function App() {
  if (!configured) {
    return (
      <div className="notice">
        Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>dashboard/.env</code> (see <code>.env.example</code>).
      </div>
    );
  }
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}
