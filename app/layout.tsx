import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "住近一点 · 上海华住酒店筛选",
  description: "按地铁距离、门店开业时间和官方点评筛选上海华住酒店。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
