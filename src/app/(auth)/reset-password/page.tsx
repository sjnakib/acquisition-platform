'use client'

import { BrandLogo } from '@/components/shared/BrandLogo'

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 glass-auth-card text-center transition-all duration-300 animate-card-entrance">
      
      {/* Brand Skyscraper Logo */}
      <div className="text-center mb-10 flex justify-center animate-item-entrance" style={{ animationDelay: '80ms' }}>
        <BrandLogo variant="full" disableLink={true} />
      </div>

      <h1 
        className="text-[21px] font-semibold text-center mb-3 tracking-tight animate-item-entrance" 
        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)', animationDelay: '140ms' }}
      >
        Reset Password
      </h1>

      <p 
        className="text-[13px] text-center mb-6 leading-relaxed animate-item-entrance" 
        style={{ color: 'var(--color-text-secondary)', animationDelay: '200ms' }}
      >
        Password reset features are currently undergoing core terminal diagnostics and will be online shortly.
      </p>

      <div className="animate-item-entrance" style={{ animationDelay: '260ms' }}>
        <a 
          href="/login" 
          className="text-[13px] font-medium hover:underline transition-all duration-300 hover:opacity-80" 
          style={{ color: 'var(--accent)' }}
        >
          Back to Sign in
        </a>
      </div>
    </div>
  )
}
