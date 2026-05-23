import { BrandLogo } from '@/components/shared/BrandLogo'

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-canvas)' }}>
      <div className="w-full max-w-[380px] rounded-xl p-8 text-center" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)', boxShadow: 'var(--shadow-md)' }}>
        <div className="mb-6 flex justify-center">
          <BrandLogo variant="icon" disableLink={true} />
        </div>
        <h1 className="text-[20px] font-medium mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Reset Password</h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-secondary)' }}>Password reset is coming soon.</p>
        <a href="/login" className="text-[13px] hover:underline" style={{ color: 'var(--accent)' }}>Back to Sign in</a>
      </div>
    </div>
  )
}
