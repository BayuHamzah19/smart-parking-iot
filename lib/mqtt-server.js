import mqtt from "mqtt";

export const TOPICS = {
  settings: "sp-69fd16a8/parking/settings",
  cmdIn: "sp-69fd16a8/parking/cmd/gate/in",
  cmdOut: "sp-69fd16a8/parking/cmd/gate/out",
};

export function mqttConfigured() {
  return Boolean(process.env.MQTT_URL);
}

// Fungsi serverless tidak bisa menahan koneksi, jadi pola yang dipakai:
// connect -> publish -> putus. Cukup untuk perintah yang jarang dikirim.
export async function publish(topic, payload, options = {}) {
  if (!mqttConfigured()) throw new Error("MQTT belum dikonfigurasi");

  const run = async () => {
    const client = await mqtt.connectAsync(process.env.MQTT_URL, {
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
      connectTimeout: 6000,
      reconnectPeriod: 0,
    });
    try {
      await client.publishAsync(topic, payload, { qos: 1, ...options });
    } finally {
      await client.endAsync();
    }
  };

  await Promise.race([
    run(),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error("MQTT timeout")), 9000)
    ),
  ]);
}
