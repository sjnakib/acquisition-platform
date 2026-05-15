import type { NextConfig } from 'next'

const cspScriptSrc = [
  "'self'",
  "'unsafe-inline'",
  'https://challenges.cloudflare.com',
  "'unsafe-eval'",
].join(' ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'] },
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            `script-src ${cspScriptSrc}`,
            "frame-src https://challenges.cloudflare.com",
            "connect-src 'self' https://*.supabase.co https://www.googleapis.com https://accounts.google.com",
            "img-src 'self' data: https://lh3.googleusercontent.com",
            "style-src 'self' 'unsafe-inline'",
          ].join('; '),
        },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ],
}

export default nextConfig
