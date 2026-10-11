import type { Metadata } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono, Newsreader } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { siteAsset } from '@/lib/site-assets'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Densify — Clinical Hair Restoration Analytics',
  description:
    'Densify is a data-driven digital health platform for tracking hair restoration outcomes, biomarkers, and visual progression.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: siteAsset('icons/icon-light-32x32.png'),
        media: '(prefers-color-scheme: light)',
      },
      {
        url: siteAsset('icons/icon-dark-32x32.png'),
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: siteAsset('icons/icon-512.png'),
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    apple: siteAsset('icons/apple-icon.png'),
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} bg-background`} suppressHydrationWarning>
      {/* No-flash script: apply saved theme class before first paint */}
      <head>
        <Script id="theme-initializer" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('densify-theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})()`}
        </Script>
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_UMAMI_SRC && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={process.env.NEXT_PUBLIC_UMAMI_SRC}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
