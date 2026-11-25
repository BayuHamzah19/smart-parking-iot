import mqtt from "mqtt";

export const TOPICS = {
  settings: "sp-69fd16a8/parking/settings",
  cmdIn: "sp-69fd16a8/parking/cmd/gate/in",
  cmdOut: "sp-69fd16a8/parking/cmd/gate/out",
};

export function mqttConfigured() {
  return Boolean(process.env.MQTT_URL || process.env.NEXT_PUBLIC_MQTT_WS_URL);
}

// Fungsi serverless tidak bisa menahan koneksi, jadi pola yang dipakai:
// connect -> publish -> putus.
// Menggunakan mekanisme auto-retry (hingga 3x) untuk menangani lonjakan beban
// atau timeout connack pada broker publik HiveMQ.
export async function publish(topic, payload, options = {}) {
  if (!mqttConfigured()) throw new Error("MQTT belum dikonfigurasi");

  // Jika menggunakan broker.hivemq.com, gunakan port WebSocket Secure (8884)
  // karena port raw TCP 1883 sering connack timeout di serverless cloud / Vercel.
  let brokerUrl = process.env.MQTT_URL || "wss://broker.hivemq.com:8884/mqtt";
  if (brokerUrl.includes("broker.hivemq.com:1883") || brokerUrl === "mqtt://broker.hivemq.com") {
    brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const clientId = `vcl_${Math.random().toString(16).slice(2, 10)}`;
    let client = null;
    try {
      client = await mqtt.connectAsync(brokerUrl, {
        clientId,
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        connectTimeout: 4000,
        reconnectPeriod: 0,
        clean: true,
      });
      await client.publishAsync(topic, payload, { qos: 0, ...options });
      await client.endAsync(true);
      return; // Sukses terkirim!
    } catch (e) {
      lastErr = e;
      if (client) {
        try { await client.endAsync(true); } catch {}
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  throw lastErr || new Error("Gagal terhubung ke broker MQTT setelah 3x percobaan");
}
