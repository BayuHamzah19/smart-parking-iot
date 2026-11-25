import "./globals.css";

export const metadata = {
  title: "Smart Parking Admin",
  description: "Dashboard admin sistem Smart Parking berbasis IoT",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
