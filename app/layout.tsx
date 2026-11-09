import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import DynamicBackground from "./dynamic-background";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "多智能体协作台 · 蜂群小队",
  description:
    "一个任务派给调度、调研、文案、代码四个专家并行完成，汇总后质检，满 80 分才交付。",
  openGraph: {
    title: "多智能体协作台",
    description: "让小团队低成本拥有一个 AI 团队",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "多智能体协作台",
    description: "让小团队低成本拥有一个 AI 团队",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-void text-ink">
        <DynamicBackground />
        {children}
      </body>
    </html>
  );
}
