import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'News Typing App',
  description: 'Practice typing with AI-summarized news articles',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background dark:bg-background-dark text-text dark:text-text-dark`}>
        {children}
      </body>
    </html>
  )
} 