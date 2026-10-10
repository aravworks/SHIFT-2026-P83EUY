import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { useFleet } from "../useFleetData";

const NAV = [
  { to: "/", label: "Overview", roles: ["admin", "fleet", "station"] },
  { to: "/alerts", label: "Alerts", roles: ["admin", "fleet", "station"] },
  { to: "/stations", label: "Stations", roles: ["admin", "fleet", "station"] },
  { to: "/vehicles", label: "Vehicles", roles: ["admin", "fleet"] },
  { to: "/api", label: "Vehicle API", roles: ["admin", "fleet"] },
];

export function Layout() {
  const { session, role, signOut } = useAuth();
  const { error } = useFleet();
  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">⚡ VoltMesh</div>
        {NAV.filter((n) => role && n.roles.includes(role)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="who">
          <div>{session?.user.email}</div>
          <small>{role}</small>
          <button onClick={signOut}>Sign out</button>
        </div>
      </nav>
      <div className="content">
        {error && <div className="banner">Data error: {error}</div>}
        <Outlet />
      </div>
    </div>
  );
}
