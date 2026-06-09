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
    "墨鱼π — AI 创意工作台：文生图、画布精修、灵感同款与套图 Agent。",
  openGraph: {
    title: `${BRAND_NAME} - ${BRAND_SLOGAN}`,
    description: BRAND_SLOGAN,
    type: "website",
    locale: "zh_CN",
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} - ${BRAND_SLOGAN}`,
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
