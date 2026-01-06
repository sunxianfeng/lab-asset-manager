import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lab Asset Manager",
  description: "Asset inventory and lending management for lab cabinets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh antialiased">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
