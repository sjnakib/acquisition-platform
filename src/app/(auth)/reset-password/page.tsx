export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-canvas)' }}>
      <div className="w-full max-w-[380px] rounded-[14px] p-8 text-center" style={{ background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-2)', boxShadow: 'var(--shadow-md)' }}>
        <div className="mb-6">
          <span className="text-2xl" style={{ color: 'var(--accent)' }}>◆</span>
        </div>
        <h1 className="text-[20px] font-medium mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>Reset Password</h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-secondary)' }}>Password reset is coming soon.</p>
        <a href="/login" className="text-[13px] hover:underline" style={{ color: 'var(--accent)' }}>Back to Sign in</a>
      </div>
    </div>
  )
}
