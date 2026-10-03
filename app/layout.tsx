import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

export const metadata: Metadata = {
  title: "Nexus CRM",
  description: "Professional CRM solution for managing clients and cases",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
