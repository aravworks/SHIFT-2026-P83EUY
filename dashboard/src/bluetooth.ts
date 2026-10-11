// Web Bluetooth helpers. Limits to keep in mind (they are the browser's, not ours):
//  - Chrome / Edge on desktop and Android only; HTTPS or localhost; every scan needs a user click.
//  - Bluetooth Low Energy (GATT) only. Classic Bluetooth (most headphone audio, OBEX file transfer) is not reachable.
//  - The page cannot list nearby or connected devices; the user picks from the browser's chooser.
//  - Only services declared at scan time (optionalServices) can be accessed afterwards.

export const supportsBluetooth = typeof navigator !== "undefined" && "bluetooth" in navigator;
export const supportsShare = typeof navigator !== "undefined" && "share" in navigator;

const STANDARD_SERVICES: BluetoothServiceUUID[] = ["battery_service", "device_information", "generic_access"];

/** "180f" / "0x180f" -> 16-bit number; a full 128-bit UUID is passed through. */
export function normalizeUuid(raw: string): BluetoothServiceUUID {
  const s = raw.trim().toLowerCase();
  const short = s.replace(/^0x/, "");
  if (/^[0-9a-f]{4}$/.test(short)) return parseInt(short, 16);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) return s;
  throw new Error(`"${raw}" is not a 16-bit (e.g. 180f) or full 128-bit UUID`);
}

/** Opens the browser's device chooser. Extra service UUIDs must be declared here to be usable later. */
export function pickDevice(extraServices: string[] = []): Promise<BluetoothDevice> {
  return navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [...STANDARD_SERVICES, ...extraServices.map(normalizeUuid)],
  });
}

/** Devices this site was already granted access to (not supported in every Chrome version). */
export async function previouslyGranted(): Promise<BluetoothDevice[]> {
  const bt = navigator.bluetooth as Bluetooth & { getDevices?: () => Promise<BluetoothDevice[]> };
  try {
    return bt.getDevices ? await bt.getDevices() : [];
  } catch {
    return [];
  }
}

export interface DeviceInfo {
  batteryPct?: number;
  manufacturer?: string;
  model?: string;
  firmware?: string;
}

const text = (v: DataView) => new TextDecoder().decode(v.buffer);

async function tryRead<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined; // the device simply does not expose this characteristic
  }
}

export async function connect(device: BluetoothDevice): Promise<BluetoothRemoteGATTServer> {
  if (!device.gatt) throw new Error("This device has no GATT server");
  return device.gatt.connected ? device.gatt : device.gatt.connect();
}

/** Reads the standard Battery and Device Information characteristics when the device exposes them. */
export async function readInfo(device: BluetoothDevice): Promise<DeviceInfo> {
  const server = await connect(device);
  const info: DeviceInfo = {};

  const battery = await tryRead(async () => {
    const svc = await server.getPrimaryService("battery_service");
    const ch = await svc.getCharacteristic("battery_level");
    return (await ch.readValue()).getUint8(0);
  });
  if (battery !== undefined) info.batteryPct = battery;

  const dis = await tryRead(() => server.getPrimaryService("device_information"));
  if (dis) {
    info.manufacturer = await tryRead(async () => text(await (await dis.getCharacteristic("manufacturer_name_string")).readValue()));
    info.model = await tryRead(async () => text(await (await dis.getCharacteristic("model_number_string")).readValue()));
    info.firmware = await tryRead(async () => text(await (await dis.getCharacteristic("firmware_revision_string")).readValue()));
  }
  return info;
}

export function parsePayload(input: string, mode: "text" | "hex"): Uint8Array {
  if (mode === "text") return new TextEncoder().encode(input);
  const clean = input.replace(/\s|0x/gi, "");
  if (!/^([0-9a-f]{2})*$/i.test(clean) || clean.length === 0) throw new Error("Hex payload must be an even number of hex digits");
  return Uint8Array.from(clean.match(/../g)!.map((b) => parseInt(b, 16)));
}

export const toHex = (v: DataView) => Array.from(new Uint8Array(v.buffer), (b) => b.toString(16).padStart(2, "0")).join(" ");

async function characteristic(device: BluetoothDevice, service: string, ch: string) {
  const server = await connect(device);
  const svc = await server.getPrimaryService(normalizeUuid(service));
  return svc.getCharacteristic(normalizeUuid(ch));
}

export async function readCharacteristic(device: BluetoothDevice, service: string, ch: string): Promise<DataView> {
  return (await characteristic(device, service, ch)).readValue();
}

/** Writes with response when supported. Typical BLE writes are limited to ~20-512 bytes per call. */
export async function writeCharacteristic(device: BluetoothDevice, service: string, ch: string, data: Uint8Array): Promise<void> {
  const c = await characteristic(device, service, ch);
  if (data.length > 512) throw new Error("Payload over 512 bytes: BLE characteristic writes cannot carry files");
  if (c.properties.write) await c.writeValue(data as BufferSource);
  else if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(data as BufferSource);
  else throw new Error("This characteristic is not writable");
}
