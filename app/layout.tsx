import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'HF 农场成品菜管理系统',
  description: 'HF Farm 成品菜收成与库存管理系统 — 每日收菜登记、汇总报表、数据导出',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#22c55e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} h-full`}>
      <body className="h-full overflow-x-hidden antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
