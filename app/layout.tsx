import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDNS+",
  description: "Selfhosted Dynamic DNS dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      data-scroll-behavior="smooth"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
