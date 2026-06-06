import './globals.css';
import Navigation from '@/components/Navigation';
import Image from 'next/image';
import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-9TNT5F6YWP';

export const metadata = {
  title: 'Human OS | Understand Yourself Better Every Day',
  description: 'Write a reflection. See your patterns. Understand why you think and act the way you do. Human OS turns your thoughts into clear, useful insights.',
  metadataBase: new URL('https://humanos.ai'),
  applicationName: 'Human OS',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/logo.jpg', type: 'image/jpeg' },
      { url: '/app-icon.svg', type: 'image/svg+xml' }
    ],
    apple: [{ url: '/app-icon.svg', type: 'image/svg+xml' }]
  },
  openGraph: {
    title: 'Human OS',
    description: 'The Operating System For Understanding Yourself. Powered by Viyaan AI.',
    type: 'website',
    images: [
      {
        url: '/logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Human OS powered by Viyaan AI'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Human OS',
    description: 'The Operating System For Understanding Yourself.',
    images: ['/logo.jpg']
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050505'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      {/* Google Analytics 4 */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            page_title: document.title,
            page_location: window.location.href,
            anonymize_ip: true
          });
        `}
      </Script>
      <body className="antialiased bg-[#050505] text-white min-h-screen flex flex-col selection:bg-[#6EE7FF]/30 selection:text-white relative overflow-x-hidden">
        {/* Apple-style subtle cyan top spotlight glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[320px] bg-gradient-to-b from-[#6EE7FF]/[0.03] to-transparent blur-[120px] pointer-events-none z-0 rounded-full animate-pulse-glow" />
        
        {/* Soft bottom glow to balance composition */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[200px] bg-gradient-to-t from-[#6EE7FF]/[0.01] to-transparent blur-[100px] pointer-events-none z-0 rounded-full" />
        
        {/* Top Header Navbar */}
        <header className="relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-6 flex justify-between items-center border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/10 shadow-[0_0_12px_rgba(110,231,255,0.1)]">
              <Image src="/logo.jpg" alt="Viyaan AI Logo" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wider uppercase text-white/90">Human OS</h1>
              <p className="text-[9px] uppercase tracking-widest text-[#71717A] -mt-0.5">Viyaan AI Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-semibold tracking-wider text-emerald-400 uppercase">System Live</span>
          </div>
        </header>

        {/* Main View Container */}
        <main className="relative z-10 flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-8 pb-32 flex flex-col justify-start">
          {children}
        </main>

        <footer className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pb-[calc(7rem+env(safe-area-inset-bottom))] text-center">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase text-[#71717A] flex-wrap justify-center">
            <span>Powered by</span>
            <Image src="/logo.jpg" alt="" width={16} height={16} aria-hidden="true" className="rounded-sm" />
            <span className="text-white/70">Viyaan AI</span>
            <span className="hidden sm:inline mx-1 text-white/20">|</span>
            <span className="text-[#71717A] block sm:inline">Build Intelligence. Understand Humans.</span>
          </div>
        </footer>

        <Navigation />
      </body>
    </html>
  );
}
