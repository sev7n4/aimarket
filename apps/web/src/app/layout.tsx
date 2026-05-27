import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AIMarket - 电商出图与宣传短视频",
    template: "%s | AIMarket",
  },
  description:
    "专注电商主图、套图、详情出图；基于商品图一键生成产品宣传短视频。模板同款、套图 Agent、画布精修。",
  openGraph: {
    title: "AIMarket - 从商品主图到宣传短视频",
    description:
      "电商出图工作台：主图套图一键生成，基于出图自动产出产品宣传短视频。",
    type: "website",
    locale: "zh_CN",
    siteName: "AIMarket",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIMarket - 电商出图与宣传短视频",
    description: "电商主图套图 + 基于出图的产品宣传短视频",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
