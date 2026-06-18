import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
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

/** 品牌 Slogan 展示衬线（中文艺术标题感） */
const brandDisplay = Noto_Serif_SC({
  variable: "--font-brand-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
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
    images: [{ url: "/brand/mascot-256.png", width: 256, height: 256, alt: BRAND_NAME }],
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
        className={`${geistSans.variable} ${geistMono.variable} ${brandDisplay.variable} antialiased`}
      >
        <AuthProvider>
          <InviteCaptureRoot />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
