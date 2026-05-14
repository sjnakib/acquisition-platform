export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Reset Password</h1>
        <p className="text-slate-500 text-sm">Password reset is coming soon.</p>
        <a href="/login" className="inline-block mt-4 text-sm text-blue-600 underline">
          Back to Sign in
        </a>
      </div>
    </div>
  )
}
