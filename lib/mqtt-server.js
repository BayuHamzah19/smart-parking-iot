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
// connect -> publish -> putus. Cukup untuk perintah yang jarang dikirim.
export async function publish(topic, payload, options = {}) {
  if (!mqttConfigured()) throw new Error("MQTT belum dikonfigurasi");

  // Jika menggunakan broker.hivemq.com, gunakan port WebSocket Secure (8884)
  // karena port raw TCP 1883 sering connack timeout di serverless cloud / Vercel.
  let brokerUrl = process.env.MQTT_URL || "wss://broker.hivemq.com:8884/mqtt";
  if (brokerUrl.includes("broker.hivemq.com:1883") || brokerUrl === "mqtt://broker.hivemq.com") {
    brokerUrl = "wss://broker.hivemq.com:8884/mqtt";
  }

  const clientId = `vcl_${Math.random().toString(16).slice(2, 10)}`;

  const run = async () => {
    const client = await mqtt.connectAsync(brokerUrl, {
      clientId,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      connectTimeout: 7000,
      reconnectPeriod: 0,
      clean: true,
    });
    try {
      await client.publishAsync(topic, payload, { qos: 0, ...options });
    } finally {
      await client.endAsync(true);
    }
  };

  await Promise.race([
    run(),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error("MQTT timeout")), 8000)
    ),
  ]);
}
