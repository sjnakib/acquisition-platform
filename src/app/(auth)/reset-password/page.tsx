export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#0E0E0E' }}>
      <div className="fixed pointer-events-none" style={{ top: -200, right: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,150,60,0.08) 0%, transparent 70%)' }} />
      <div className="w-full max-w-[380px] rounded-[14px] p-8 text-center max-sm:bg-transparent max-sm:border-0 max-sm:p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
        <div className="mb-6">
          <span className="text-2xl" style={{ color: 'var(--accent)' }}>◆</span>
        </div>
        <h1 className="text-[20px] font-medium mb-2" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-dm-sans)' }}>Reset Password</h1>
        <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>Password reset is coming soon.</p>
        <a href="/login" className="text-[13px] hover:underline" style={{ color: 'var(--accent)' }}>Back to Sign in</a>
      </div>
    </div>
  )
}
