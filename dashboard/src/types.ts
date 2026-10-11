export type Role = "admin" | "fleet" | "station";

export interface Alert {
  msg_id: number;
  origin_node: number | null;
  category: "low_battery" | "stranded" | "thermal" | "crash" | "other";
  priority: number | null;
  lat: number;
  lon: number;
  created_at: string;
  received_at: string;
  ingress: "direct" | "mesh" | "vehicle";
  gateway_node: number | null;
  status: "open" | "help_sent" | "resolved";
  vehicle_id: string | null;
}

/** Row of the station_availability view: stock minus active holds. */
export interface Station {
  id: string;
  name: string | null;
  node_id: number;
  lat: number;
  lon: number;
  batteries_available: number | null;
  held_count: number;
  available: number;
  stock_updated_at: string | null;
}

export interface Hop {
  msg_id: number;
  node_id: number;
  hop: number;
  transport: "ble" | "wfd" | "gateway";
  powered: boolean | null;
  rssi: number | null;
  received_at: string;
  prev_node?: number | null;
  tag_valid?: boolean | null;
}

export interface GridCluster {
  alert_count: number;
  centroid_lat: number;
  centroid_lon: number;
  max_priority: number | null;
  msg_ids: number[];
}

export interface Vehicle {
  id: string;
  label: string;
  make: string | null;
  model: string | null;
  fleet: string | null;
  active: boolean;
  km_per_pct: number | null;
  safety_margin: number | null;
  thermal_limit_c: number | null;
  last_soc: number | null;
  last_temp_c: number | null;
  last_lat: number | null;
  last_lon: number | null;
  last_seen: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  station_id: string;
  vehicle_id: string | null;
  alert_msg_id: number | null;
  status: "held" | "picked_up" | "expired" | "cancelled";
  created_at: string;
  expires_at: string;
}

export interface HelpOffer {
  id: string;
  alert_msg_id: number;
  helper_node: number;
  eta_minutes: number | null;
  status: "offered" | "withdrawn";
  created_at: string;
}
