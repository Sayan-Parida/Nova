import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/context/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import { NetworkErrorListener } from '@/components/network-error-listener'
import { DailyPillReminder } from '@/components/daily-pill-reminder'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Nova - Privacy-First Period Tracker',
  description: 'Track your cycle. Own your data. Nova is a privacy-first period tracker that keeps your information secure and local.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <NetworkErrorListener />
          <DailyPillReminder />
          <Toaster />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  )
}
