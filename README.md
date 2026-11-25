# Smart Parking (Next.js + ESP32 + MQTT + Neon)

Sistem smart parking otomatis berbasis IoT menggunakan ESP32, 2 sensor IR Obstacle, dan 2 motor servo Tower Pro MG90S Micro, terintegrasi dengan web dashboard Next.js 16.

```
ESP32 (IR + Servo) ──MQTT──▶ Broker HiveMQ ──WebSocket──▶ Dashboard Admin (Live)
       │                              ▲
       │ HTTPS / HTTP                 │ publish perintah palang
       ▼                              │
 API Next.js (Local / Vercel) ────────┴───────────────▶ Database Neon Postgres
```

---

## 🚀 PANDUAN LANGKAH KERJA SEKARANG (Step-by-Step)

Ikuti urutan langkah di bawah ini untuk merakit dan menjalankan sistem dari awal sampai berfungsi penuh:

### Langkah 1: Merangkai Komponen di Breadboard

Gunakan kabel jumper male-to-female dan male-to-male untuk menghubungkan ESP32, 6 Sensor IR, 4 LED Slot, dan 2 Servo MG90S.

#### Peta Pin Fisik ESP32 DevKit V1 (30 Pin):
```
                [ ANTENA ESP32 ]
                ┌──────────────┐
     (Atas) EN ─┤ 1          30├─ D23 (IR Slot 3)
           VP  ─┤ 2          29├─ D22 (IR Slot 2)
           VN  ─┤ 3          28├─ TX0
          D34  ─┤ 4          27├─ RX0
          D35  ─┤ 5          26├─ D21 (IR Slot 1)
(LED Slot 3) D32 ─┤ 6          25├─ D19 (IR Gerbang Keluar)
(LED Slot 4) D33 ─┤ 7          24├─ D18 (IR Gerbang Masuk)
(IR Slot 4)  D25 ─┤ 8          23├─ D5
(LED Slot 1) D26 ─┤ 9          22├─ TX2 (D17)
(LED Slot 2) D27 ─┤ 10         21├─ RX2 (D16)
(Servo Keluar) D14 ─┤ 11         20├─ D4
          D12  ─┤ 12         19├─ D2
(Servo Masuk)  D13 ─┤ 13         18├─ D15
(GND 5V)   GND ─┤ 14         17├─ GND (GND 3.3V)
(5V Servo) VIN ─┤ 15         16├─ 3V3 (3.3V IR Sensor)
                └──[ USB PORT ]┘
```

#### Pembagian Jalur Daya 2 Breadboard:
* **Breadboard KIRI (5V Servo)**:
  * Kabel Putih: Pin `VIN` (kiri bawah) $\rightarrow$ Rel Merah (+) Kiri
  * Kabel Biru: Pin `GND` (kiri bawah) $\rightarrow$ Rel Biru (-) Kiri
* **Breadboard KANAN (3.3V IR Sensor & LED)**:
  * Kabel Ungu: Pin `3V3` (kanan bawah) $\rightarrow$ Rel Merah (+) Kanan
  * Kabel Hitam: Pin `GND` (kanan bawah) $\rightarrow$ Rel Biru (-) Kanan

#### Tabel Pinout Lengkap:
| Komponen | Pin di Modul/Komponen | Hubungkan ke ESP32 / Breadboard | Keterangan |
| :--- | :--- | :--- | :--- |
| **Kabel Putih Daya** | ESP32 VIN (Pin 15 kiri) | **Rel Merah (+) Breadboard Kiri** | Sumber 5V Servo |
| **Kabel Biru Daya** | ESP32 GND (Pin 14 kiri) | **Rel Biru (-) Breadboard Kiri** | Ground 5V Servo |
| **Kabel Ungu Daya** | ESP32 3V3 (Pin 16 kanan) | **Rel Merah (+) Breadboard Kanan** | Sumber 3.3V Sensor IR |
| **Kabel Hitam Daya** | ESP32 GND (Pin 17 kanan) | **Rel Biru (-) Breadboard Kanan** | Ground 3.3V Sensor IR & LED |
| **2 Servo MG90S** | Cokelat (GND) & Merah (5V) | **Rel Biru (-) & Merah (+) Kiri** | Suplai 5V dari VIN USB |
| **Servo Palang Masuk** | Sinyal Oranye | **Pin D13** ESP32 | PWM Palang Masuk |
| **Servo Palang Keluar** | Sinyal Oranye | **Pin D14** ESP32 | PWM Palang Keluar |
| **6 Sensor IR** | VCC & GND | **Rel Merah (+) & Biru (-) Kanan**| Suplai 3.3V Sensor |
| **IR Gerbang Masuk** | Pin OUT | **Pin D18** ESP32 | Deteksi gerbang masuk |
| **IR Gerbang Keluar** | Pin OUT | **Pin D19** ESP32 | Deteksi gerbang keluar |
| **IR Slot 1** | Pin OUT | **Pin D21** ESP32 | Deteksi mobil Slot 1 |
| **IR Slot 2** | Pin OUT | **Pin D22** ESP32 | Deteksi mobil Slot 2 |
| **IR Slot 3** | Pin OUT | **Pin D23** ESP32 | Deteksi mobil Slot 3 |
| **IR Slot 4** | Pin OUT | **Pin D25** ESP32 | Deteksi mobil Slot 4 |
| **LED Indikator Slot 1** | Kaki Panjang (+) | **Pin D26** (Kaki pendek ke GND Kanan) | Menyala saat Slot 1 terisi |
| **LED Indikator Slot 2** | Kaki Panjang (+) | **Pin D27** (Kaki pendek ke GND Kanan) | Menyala saat Slot 2 terisi |
| **LED Indikator Slot 3** | Kaki Panjang (+) | **Pin D32** (Kaki pendek ke GND Kanan) | Menyala saat Slot 3 terisi |
| **LED Indikator Slot 4** | Kaki Panjang (+) | **Pin D33** (Kaki pendek ke GND Kanan) | Menyala saat Slot 4 terisi |

> [!TIP]
> **Tips Catu Daya**: Servo MG90S adalah micro servo yang aman ditenagai dari pin `VIN` ESP32 asalkan dicolokkan ke port USB 3.0 laptop atau charger HP 5V (1A–2A). Gunakan miniatur palang yang ringan (misal stik es krim kayu atau sedotan).

---

### Langkah 2: Menyiapkan Arduino IDE & Library

1. Buka software **Arduino IDE** di laptop.
2. Pastikan Board ESP32 sudah terpasang. Pilih board: **ESP32 Dev Module**.
3. Pasang 3 library berikut melalui menu **Sketch > Include Library > Manage Libraries...**:
   * **ESP32Servo** (oleh Kevin Harrington)
   * **ArduinoJson** (pilih **versi 7.x**, oleh Benoît Blanchon)
   * **PubSubClient** (oleh Nick O'Leary)

---

### Langkah 3: Mengatur WiFi dan IP Laptop di Firmware

1. Buka file firmware utama di Arduino IDE:
   `firmware/smart_parking/smart_parking.ino`
2. Periksa bagian konfigurasi di baris 26:
   ```cpp
   // ====== ISI BAGIAN INI ======
   const char* WIFI_SSID     = "NAMA_WIFI_ATAU_HOTSPOT";
   const char* WIFI_PASSWORD = "PASSWORD_WIFI";

   // Ganti dengan IP laptop Anda saat ini (port 3000)
   const char* BASE_URL       = "http://192.168.x.x:3000";
   const char* DEVICE_API_KEY = "3d6a8fcc11e10c1fc164c100e31b0127f6552e3d6a72953705541ceb4e6e735d";

   const char* MQTT_HOST = "192.168.x.x";  // IP laptop (jika broker lokal aktif) atau kosongkan "" jika belum pakai MQTT
   const int   MQTT_PORT = 1883;
   ```
   *Catatan:* Untuk mengetahui alamat IP laptop Anda, jalankan `hostname -I` di terminal Linux. Pastikan ESP32 dan laptop terhubung ke jaringan WiFi/hotspot yang sama.

---

### Langkah 4: Menjalankan Server Dashboard di Laptop

Buka terminal di folder project ini:

```bash
# 1. Pastikan dependensi terpasang
npm install

# 2. Inisialisasi tabel database (cukup 1 kali)
npm run db:init

# 3. Jalankan server lokal Next.js
npm run dev
```

Buka browser ke [http://localhost:3000](http://localhost:3000) dan login menggunakan username/password admin dari file `.env.local`.

---

### Langkah 5: Kalibrasi Sensor IR & Upload Firmware

1. Tancapkan kabel USB ESP32 ke laptop.
2. Di Arduino IDE, pilih Port USB ESP32 Anda (misal `/dev/ttyUSB0` pada Linux).
3. Klik tombol **Upload** (tanda panah ke kanan).
4. Setelah proses upload selesai, buka **Serial Monitor** di Arduino IDE dan atur kecepatan baud ke **115200**.
5. **Kalibrasi Sensor IR**:
   * Dekatkan tangan/miniatur mobil ke depan Sensor IR Masuk (jarak ~5–10 cm).
   * Putar trimpot/potensiometer kecil warna biru di modul IR dengan obeng sampai lampu LED indikatornya menyala tepat saat ada objek, dan mati saat objek menjauh.
   * Lakukan hal yang sama untuk Sensor IR Keluar.

---

### Langkah 6: Uji Coba Sistem Menyeluruh

1. **Uji Kendaraan Masuk**:
   * Halangi Sensor IR Masuk dengan miniatur mobil/tangan.
   * Palang masuk (Servo GPIO 13) akan berputar 90° (terbuka) selama 4 detik, lalu menutup kembali.
   * Di Serial Monitor akan muncul log: `[EVENT] Kendaraan masuk, terisi 1/10`.
   * Di browser [http://localhost:3000](http://localhost:3000), slot parkir terisi akan otomatis bertambah!
2. **Uji Kendaraan Keluar**:
   * Halangi Sensor IR Keluar.
   * Palang keluar (Servo GPIO 14) akan membuka 90° selama 4 detik, lalu menutup.
   * Jumlah kendaraan terisi di dashboard akan berkurang kembali.

---

## 🛠️ Pemecahan Masalah (Troubleshooting)

| Gejala Masalah | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| **ESP32 Restart saat servo bergerak** (`Brownout detector was triggered`) | Arus drop mendadak saat motor servo menyentak | Gunakan charger HP 5V 2A atau pasang kapasitor 100µF–470µF di antara pin 5V dan GND breadboard. |
| **Sensor IR selalu mendeteksi / tidak merespons** | Trimpot sensitivitas belum pas atau cahaya ruangan mengganggu | Putar baut kecil pada modul IR sampai LED indikator hanya menyala saat ada halangan di dekatnya. |
| **Palang berputar ke arah terbalik** | Posisi pasang horn servo belum disesuaikan | Ubah nilai `ANGLE_OPEN` atau `ANGLE_CLOSED` di kode, atau lepas baling-baling plastik servo lalu pasang kembali pada posisi 0° saat kondisi tertutup. |
| **Perangkat di dashboard selalu "Offline"** | ESP32 tidak bisa mengakses API di laptop | 1. Cek apakah IP laptop di `BASE_URL` sudah benar (`hostname -I`).<br>2. Pastikan laptop dan ESP32 di satu WiFi.<br>3. Pastikan `npm run dev` berjalan. |

---

## 📁 Struktur File Penting

```
smart-parking/
├── app/                        # Halaman Web Next.js (Dashboard & API)
├── components/Dashboard.jsx     # Tampilan live dashboard & grafik
├── firmware/smart_parking/      # KODE UTAMA ESP32
│   └── smart_parking.ino       # Skrip Arduino untuk 2 IR + 2 Servo MG90S
├── lib/                        # Koneksi database Neon & MQTT
├── scripts/                    # Skrip inisialisasi database & simulator
└── README.md                   # Panduan ini
```
