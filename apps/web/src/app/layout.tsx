import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { InviteCaptureRoot } from "@/components/invite-capture-root";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";
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
    default: `${BRAND_NAME} - ${BRAND_SLOGAN}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "出图宝专注电商主图、套图、详情出图，并基于商品图生成宣传短视频。模板同款、套图 Agent、画布精修。",
  openGraph: {
    title: `${BRAND_NAME} - ${BRAND_SLOGAN}`,
    description:
      "电商出图工作台：商品图到短视频，一套做完上架。",
    type: "website",
    locale: "zh_CN",
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} - 电商出图与宣传短视频`,
    description: BRAND_SLOGAN,
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
        <AuthProvider>
          <InviteCaptureRoot />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
