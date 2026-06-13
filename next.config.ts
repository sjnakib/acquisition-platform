import type { NextConfig } from 'next'

const cspScriptSrc = [
  "'self'",
  "'unsafe-inline'",
  'https://challenges.cloudflare.com',
  "'unsafe-eval'",
  'https://apis.google.com',
  'https://*.googleapis.com',
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
            "frame-src https://challenges.cloudflare.com https://docs.google.com https://accounts.google.com",
            "connect-src 'self' https://*.supabase.co https://www.googleapis.com https://accounts.google.com https://*.googleapis.com",
            "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleapis.com",
            "style-src 'self' 'unsafe-inline' https://*.googleapis.com",
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
