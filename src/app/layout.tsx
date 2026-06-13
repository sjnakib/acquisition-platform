import type { Metadata } from "next";
import "./globals.css";
import ReactQueryProvider from "@/components/shared/ReactQueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
};

const themeScript = `(function(){try{var t=localStorage.getItem('acq_theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface-0)',
              border: '1px solid var(--color-surface-3)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  );
}
