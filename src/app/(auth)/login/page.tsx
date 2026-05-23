'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { TurnstileWidget } from '@/components/auth/TurnstileWidget'
import { BrandLogo } from '@/components/shared/BrandLogo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Spark {
  x: number // current grid x coordinate (in pixels)
  y: number // current grid y coordinate (in pixels)
  targetX: number // target grid x
  targetY: number // target grid y
  speed: number // speed of travel
  progress: number // travel progress (0 to 1)
  trail: { x: number; y: number }[] // historical coordinates for trailing sparks
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileError, setTurnstileError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef({ x: 0, y: 0, active: false, easeX: 0, easeY: 0 })

  // ----------------------------------------------------
  // HIGH-PERFORMANCE ELECTRIC GRID ENGINE (Theme Adaptive)
  // ----------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Config Grid variables
    const gridSpacing = 42
    const sparkCount = 18

    // Generate Sparks zipping along the grids
    let sparks: Spark[] = []
    
    // Get random grid intersection alignment
    const getRandomGridIntersection = (axis: 'x' | 'y', maxVal: number) => {
      const intersections = Math.floor(maxVal / gridSpacing)
      return Math.floor(Math.random() * intersections) * gridSpacing
    }

    const createSpark = (): Spark => {
      const alignX = getRandomGridIntersection('x', width)
      const alignY = getRandomGridIntersection('y', height)
      
      const isHorizontal = Math.random() > 0.5
      const targetX = isHorizontal 
        ? alignX + (Math.random() > 0.5 ? gridSpacing : -gridSpacing) 
        : alignX
      const targetY = !isHorizontal 
        ? alignY + (Math.random() > 0.5 ? gridSpacing : -gridSpacing) 
        : alignY

      return {
        x: alignX,
        y: alignY,
        targetX,
        targetY,
        speed: Math.random() * 0.05 + 0.02,
        progress: 0,
        trail: []
      }
    }

    // Pre-populate sparks list
    sparks = Array.from({ length: sparkCount }, () => createSpark())

    // Animation Loop
    const render = () => {
      // DYNAMIC MODE LOOKUP (Bypasses React virtual DOM rerenders completely)
      const isDark = document.documentElement.classList.contains('dark')

      // Theme-responsive canvas rendering styles
      const bgColor = isDark ? '#0c0f17' : '#F7F5F0'
      const accentColor = isDark ? '#48A375' : '#1E5B3F'
      const sparkColorHead = isDark ? '#4AF626' : '#10b981'
      const gridOpacityBase = isDark ? 0.035 : 0.045
      const gridOpacityActive = isDark ? 0.12 : 0.14
      const glowColor = isDark ? 'rgba(72, 163, 117, 0.06)' : 'rgba(30, 91, 63, 0.07)'
      const glowColorCenter = isDark ? 'rgba(72, 163, 117, 0.02)' : 'rgba(30, 91, 63, 0.02)'

      // Clear canvas so the theme's background variable shows through
      ctx.clearRect(0, 0, width, height)

      // 1. EASE MOUSE COORDINATES FOR DRAGGING ELASTICITY
      const mouse = mouseRef.current
      if (mouse.active) {
        mouse.easeX += (mouse.x - mouse.easeX) * 0.12
        mouse.easeY += (mouse.y - mouse.easeY) * 0.12
      }

      // 2. DRAW INTERACTIVE DYNAMIC BACKGROUND GRID LINES
      ctx.lineWidth = 1
      
      // Vertical Grid Lines
      for (let x = 0; x < width; x += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        
        let opacity = gridOpacityBase
        if (mouse.active) {
          const dist = Math.abs(x - mouse.easeX)
          if (dist < 180) {
            opacity = gridOpacityBase + (1 - dist / 180) * gridOpacityActive
          }
        }
        ctx.strokeStyle = isDark 
          ? `rgba(72, 163, 117, ${opacity})`
          : `rgba(30, 91, 63, ${opacity})`
        ctx.stroke()
      }

      // Horizontal Grid Lines
      for (let y = 0; y < height; y += gridSpacing) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        
        let opacity = gridOpacityBase
        if (mouse.active) {
          const dist = Math.abs(y - mouse.easeY)
          if (dist < 180) {
            opacity = gridOpacityBase + (1 - dist / 180) * gridOpacityActive
          }
        }
        ctx.strokeStyle = isDark
          ? `rgba(72, 163, 117, ${opacity})`
          : `rgba(30, 91, 63, ${opacity})`
        ctx.stroke()
      }

      // 3. DRAW DYNAMIC GRID LIGHTS UNDER MOUSE (LIVELY HOVER)
      if (mouse.active) {
        // Draw elegant radial light glow beneath the cursor
        const radialGrad = ctx.createRadialGradient(
          mouse.easeX, mouse.easeY, 0,
          mouse.easeX, mouse.easeY, 200
        )
        radialGrad.addColorStop(0, glowColor)
        radialGrad.addColorStop(0.5, glowColorCenter)
        radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        
        ctx.fillStyle = radialGrad
        ctx.beginPath()
        ctx.arc(mouse.easeX, mouse.easeY, 200, 0, Math.PI * 2)
        ctx.fill()

        // Highlight grid intersections close to the mouse
        const startX = Math.max(0, Math.floor((mouse.easeX - 200) / gridSpacing) * gridSpacing)
        const endX = Math.min(width, Math.ceil((mouse.easeX + 200) / gridSpacing) * gridSpacing)
        const startY = Math.max(0, Math.floor((mouse.easeY - 200) / gridSpacing) * gridSpacing)
        const endY = Math.min(height, Math.ceil((mouse.easeY + 200) / gridSpacing) * gridSpacing)

        for (let ix = startX; ix <= endX; ix += gridSpacing) {
          for (let iy = startY; iy <= endY; iy += gridSpacing) {
            const dx = ix - mouse.easeX
            const dy = iy - mouse.easeY
            const dist = Math.sqrt(dx * dx + dy * dy)
            
            if (dist < 150) {
              const intensity = (1 - dist / 150) * 0.5
              
              // Draw glowing intersection dot
              ctx.beginPath()
              ctx.arc(ix, iy, 2, 0, Math.PI * 2)
              ctx.fillStyle = isDark
                ? `rgba(74, 246, 38, ${intensity})`
                : `rgba(30, 91, 63, ${intensity * 1.2})`
              
              if (isDark) {
                ctx.shadowBlur = 4
                ctx.shadowColor = '#4AF626'
              }
              ctx.fill()
              ctx.shadowBlur = 0 // reset
            }
          }
        }
      }

      // 4. ANIMATE & DRAW ELECTRIC PULSES (SPARKS)
      sparks.forEach((s, idx) => {
        // Track current position
        const currentX = s.x + (s.targetX - s.x) * s.progress
        const currentY = s.y + (s.targetY - s.y) * s.progress

        // Add history point to trail
        s.trail.push({ x: currentX, y: currentY })
        if (s.trail.length > 8) s.trail.shift() // cap trail length

        // Draw trail segments fading out
        if (s.trail.length > 1) {
          ctx.beginPath()
          ctx.moveTo(s.trail[0]!.x, s.trail[0]!.y)
          for (let i = 1; i < s.trail.length; i++) {
            ctx.lineTo(s.trail[i]!.x, s.trail[i]!.y)
          }
          
          let distToMouse = 9999
          if (mouse.active) {
            const dx = currentX - mouse.easeX
            const dy = currentY - mouse.easeY
            distToMouse = Math.sqrt(dx * dx + dy * dy)
          }
          
          const isClose = distToMouse < 180
          ctx.strokeStyle = isClose 
            ? (isDark ? 'rgba(74, 246, 38, 0.45)' : 'rgba(30, 91, 63, 0.55)')
            : (isDark ? 'rgba(72, 163, 117, 0.35)' : 'rgba(30, 91, 63, 0.25)')
          
          ctx.lineWidth = isClose ? 1.5 : 1
          ctx.stroke()
        }

        // Draw Electric Pulse Head
        let distToMouse = 9999
        if (mouse.active) {
          const dx = currentX - mouse.easeX
          const dy = currentY - mouse.easeY
          distToMouse = Math.sqrt(dx * dx + dy * dy)
        }
        const isClose = distToMouse < 180
        
        ctx.beginPath()
        ctx.arc(currentX, currentY, isClose ? 2.5 : 1.75, 0, Math.PI * 2)
        ctx.fillStyle = isClose ? (isDark ? '#4AF626' : '#1E5B3F') : sparkColorHead
        
        if (isDark) {
          ctx.shadowBlur = isClose ? 8 : 4
          ctx.shadowColor = isClose ? '#4AF626' : '#10b981'
        }
        ctx.fill()
        ctx.shadowBlur = 0 // reset

        // Advance progress
        s.progress += s.speed
        
        // When spark reaches its target intersection, determine direction!
        if (s.progress >= 1) {
          s.x = s.targetX
          s.y = s.targetY
          s.progress = 0
          
          const isHorizontal = Math.random() > 0.5
          const step = Math.random() > 0.5 ? gridSpacing : -gridSpacing
          
          let nextTargetX = s.x
          let nextTargetY = s.y
          
          if (isHorizontal) nextTargetX = s.x + step
          else nextTargetY = s.y + step

          // Boundary checks: wrap sparks if they exit screen
          if (nextTargetX < 0 || nextTargetX > width || nextTargetY < 0 || nextTargetY > height) {
            sparks[idx] = createSpark()
          } else {
            s.targetX = nextTargetX
            s.targetY = nextTargetY
          }
        }
      })

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  // ----------------------------------------------------
  // MOUSE COORDINATE BINDINGS
  // ----------------------------------------------------
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    mouseRef.current.x = x
    mouseRef.current.y = y
    mouseRef.current.active = true
  }

  const handleMouseLeave = () => {
    mouseRef.current.active = false
  }

  // ----------------------------------------------------
  // SUBMIT HANDLER
  // ----------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!turnstileToken) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email, password, turnstileToken }) 
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401) setError('Invalid email or password.')
        else if (res.status === 429) setError('Too many attempts. Try again in 5 minutes.')
        else if (res.status === 400) setError(data.error ?? 'Bot verification failed.')
        else setError(data.error ?? 'An error occurred.')
        return
      }
      router.push(data.role === 'client' ? '/overview' : '/dashboard')
    } catch { 
      setError('An error occurred. Please try again.') 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-all duration-300 select-none" 
      style={{ background: 'var(--color-canvas)' }}
    >
      {/* 1. Theme-Responsive Glassmorphism Stylesheet Overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-login-card {
          backdrop-filter: blur(20px) saturate(110%);
          -webkit-backdrop-filter: blur(20px) saturate(110%);
          background: rgba(255, 255, 255, 0.45);
          border: 1px solid rgba(30, 91, 63, 0.08);
          box-shadow: var(--shadow-xl), 0 0 45px rgba(30, 91, 63, 0.05);
        }
        .dark .glass-login-card {
          background: rgba(25, 25, 24, 0.55);
          border: 1px solid rgba(72, 163, 117, 0.06);
          box-shadow: var(--shadow-xl), 0 0 45px rgba(72, 163, 117, 0.04);
        }
      `}} />

      {/* 2. Interactive Neon Electric Grid Canvas Backdrop */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-none w-full h-full"
      />

      {/* 3. Glassmorphic Card container */}
      <div className="w-full max-w-[380px] rounded-2xl p-8 max-sm:p-6 z-10 glass-login-card transition-all duration-300">
        
        {/* Architectural Skyscraper logo & CRT terminal diagnostics easter egg */}
        <div className="text-center mb-10 flex justify-center">
          <BrandLogo variant="full" disableLink={true} />
        </div>

        <h1 
          className="text-[21px] font-semibold text-center mb-6 tracking-tight" 
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
        >
          Welcome back
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Email address</Label>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="you@company.com" 
              autoComplete="email" 
              required 
              className="transition-all duration-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500" 
            />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.08em] block mb-1.5 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Password</Label>
            <div className="relative">
              <Input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                autoComplete="current-password" 
                required 
                className="pr-10 transition-all duration-200 focus-visible:ring-emerald-500 focus-visible:border-emerald-500" 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors" 
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-center py-1.5 z-20 relative">
            <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} onError={() => setTurnstileError(true)} />
          </div>

          {turnstileError && <p className="text-xs text-center font-medium" style={{ color: 'var(--color-danger-text)' }}>Bot check failed to load.</p>}

          <Button 
            type="submit" 
            size="lg" 
            disabled={isSubmitting || !turnstileToken} 
            className="w-full transition-all duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500 font-semibold"
          >
            {isSubmitting ? <><LoadingSpinner size="sm" /> Signing in...</> : 'Sign in'}
          </Button>
        </form>

        {error && (
          <div className="flex items-center gap-2 mt-4 rounded-lg p-3 text-[13px] font-medium" style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}>
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="mt-5 text-center">
          <a 
            href="/reset-password" 
            className="text-[13px] font-medium hover:underline transition-colors animate-pulse" 
            style={{ color: 'var(--accent)' }}
          >
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  )
}
