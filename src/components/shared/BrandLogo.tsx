'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Terminal, Sparkles, X, Play, RefreshCw, CheckCircle, Flame, ShieldAlert, Volume2, VolumeX } from 'lucide-react'
import { BRAND } from '@/lib/brand'
import { Tooltip } from '@/components/ui/tooltip'

interface BrandLogoProps {
  variant?: 'icon' | 'wordmark' | 'full'
  className?: string
  disableLink?: boolean
}

// ----------------------------------------------------
// 1. WEB AUDIO API SYNTHESIZER
// ----------------------------------------------------
let isMutedGlobal = false;

function playSynthSound(freqs: number[], duration = 0.15, type: OscillatorType = 'sine') {
  if (isMutedGlobal) return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    
    let time = ctx.currentTime
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = type
      osc.frequency.setValueAtTime(freq, time)
      
      // Beautiful decay curve for premium chimes
      gain.gain.setValueAtTime(0.03, time) // keep it quiet and elegant
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.start(time)
      osc.stop(time + duration)
      time += 0.07 // stagger notes for arpeggio
    })
  } catch (e) {
    // browser blocked or unsupported
  }
}

// ----------------------------------------------------
// 2. JAW-DROPPING ARCHITECTURAL SVG MARK
// ----------------------------------------------------
function BuildingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} transition-all duration-300 hover:scale-110 active:scale-95`}
      style={{ filter: 'drop-shadow(0 0 8px rgba(30,191,115,0.25))' }}
    >
      <defs>
        {/* Dynamic, harmonized glowing linear gradients */}
        <linearGradient id="glow-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="50%" stopColor="var(--color-accent-light)" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="glow-grad-secondary" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(16,185,129,0.15)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        
        {/* Embedded micro-animation stylesheet for glowing sweep line effect */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes sweep-animation {
            0% { transform: translateY(-20px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            100% { transform: translateY(22px); opacity: 0; }
          }
          .logo-sweep-line {
            animation: sweep-animation 3.5s infinite linear;
          }
        `}} />
      </defs>
      
      {/* Background soft shadow guide */}
      <circle cx="16" cy="16" r="14" fill="var(--glow-grad-secondary)" opacity="0.05" />
      
      {/* Structural multi-layered Skyscraper Mark representing "A" */}
      {/* Back layer */}
      <path
        d="M16 2L3 28h5.5l7.5-15 7.5 15H29L16 2z"
        fill="url(#glow-grad-primary)"
        opacity="0.9"
        style={{ transition: 'all 0.3s ease' }}
      />
      
      {/* Glass analytical front layer overlay (Forms "A" belt & visual depth) */}
      <path
        d="M16 9l-4.8 9.6h9.6L16 9z"
        fill="url(#glow-grad-secondary)"
        opacity="0.8"
      />
      
      {/* Micro-scale structural accents */}
      <rect x="14" y="24" width="4" height="6" rx="0.5" fill="var(--color-text-inverse)" opacity="0.95" />
      <circle cx="16" cy="15" r="1.5" fill="var(--color-text-inverse)" opacity="0.95" />
      
      {/* Scanning laser sweep line */}
      <line
        x1="4"
        y1="10"
        x2="28"
        y2="10"
        stroke="#4AF626"
        strokeWidth="0.75"
        className="logo-sweep-line"
        style={{ filter: 'drop-shadow(0 0 2px #4AF626)' }}
      />
    </svg>
  )
}

// ----------------------------------------------------
// 3. MAIN INTERACTIVE BRAND LOGO COMPONENT
// ----------------------------------------------------
export function BrandLogo({ variant = 'full', className = '', disableLink = false }: BrandLogoProps) {
  const [eggActive, setEggActive] = useState(false)
  const [antigravity, setAntigravity] = useState(false)
  const [muted, setMuted] = useState(false)
  
  // Game states inside the retro console
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])
  const [inputVal, setInputVal] = useState('')
  const [decryptionNode, setDecryptionNode] = useState<{ active: boolean; code: string; attempts: number; solved: boolean } | null>(null)
  
  const router = useRouter()
  const clickCountRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const logContainerRef = useRef<HTMLDivElement | null>(null)
  
  // Clear refs on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Auto-scroll terminal logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [consoleLogs])

  // Setup sound mute synchronization
  useEffect(() => {
    isMutedGlobal = muted
  }, [muted])

  // ----------------------------------------------------
  // ZERO-G CANVAS PARTICLE FLOATING SYSTEM
  // ----------------------------------------------------
  useEffect(() => {
    if (!antigravity) return
    
    // Inject global swaying CSS rules for floating atmosphere
    const styleElement = document.createElement('style')
    styleElement.id = 'zero-g-sways'
    styleElement.innerHTML = `
      body.antigravity-active main,
      body.antigravity-active aside,
      body.antigravity-active .card,
      body.antigravity-active table,
      body.antigravity-active [role="dialog"] {
        animation: zeroGSway 8s ease-in-out infinite alternate !important;
      }
      @keyframes zeroGSway {
        0% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-4px) rotate(0.2deg) translateX(1px); }
        100% { transform: translateY(2px) rotate(-0.2deg) translateX(-1px); }
      }
    `
    document.head.appendChild(styleElement)
    document.body.classList.add('antigravity-active')

    // Canvas drawing setup
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
    
    interface Particle {
      x: number
      y: number
      size: number
      speed: number
      wobble: number
      wobbleSpeed: number
      opacity: number
    }
    
    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height + height, // start from bottom
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.4 + 0.15,
      wobble: Math.random() * 2,
      wobbleSpeed: Math.random() * 0.02 + 0.005,
      opacity: Math.random() * 0.5 + 0.2
    }))
    
    const render = () => {
      ctx.clearRect(0, 0, width, height)
      
      particles.forEach((p) => {
        p.y -= p.speed
        p.wobble += p.wobbleSpeed
        const currentX = p.x + Math.sin(p.wobble) * 6
        
        // Wrap particle if it goes off top
        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        
        // Draw futuristic matrix glowing circle particles
        ctx.beginPath()
        ctx.arc(currentX, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(16, 185, 129, ${p.opacity})`
        ctx.shadowBlur = 4
        ctx.shadowColor = '#10b981'
        ctx.fill()
        ctx.shadowBlur = 0 // reset
      })
      
      animationFrameId = requestAnimationFrame(render)
    }
    
    render()
    
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
      document.body.classList.remove('antigravity-active')
      const styleNode = document.getElementById('zero-g-sways')
      if (styleNode) document.head.removeChild(styleNode)
    }
  }, [antigravity])

  // ----------------------------------------------------
  // EASTER EGG INITIATION & CONSOLE BOOT SEQUENCE
  // ----------------------------------------------------
  const bootConsole = useCallback(() => {
    playSynthSound([523.25, 659.25, 783.99, 1046.50], 0.35, 'triangle') // futuristic chime!
    setEggActive(true)
    setConsoleLogs([
      '==============================================',
      '     ACQUIRE ADVANCED QUANTUM SHELL v2.0     ',
      '==============================================',
      'INITIALIZING CRT INTERFACE SCAN...',
      '[OK] DUAL-GRADIENT VECTOR CORE ONLINE',
      '[OK] SUPABASE ANON GATEWAY SECURED',
      '[OK] DEEPMIND ANTIGRAVITY ENGINE MOUNTED',
      '[SYS] HOST STATUS: COMPILING AND RESOLVED (0 ERRORS)',
      'Type "help" for a list of available quantum queries.',
      '----------------------------------------------'
    ])
  }, [])

  const toggleAntigravity = useCallback((manualText = '') => {
    const next = !antigravity
    setAntigravity(next)
    
    if (next) {
      playSynthSound([150, 300, 450], 0.6, 'sawtooth') // low hum
      if (manualText) {
        setConsoleLogs(prev => [...prev, `[SUCCESS] ${manualText}`, '>> GRAVITY REGULATOR ENGAGED. ENJOY WEIGHTLESSNESS.'])
      }
    } else {
      playSynthSound([450, 300, 150], 0.4, 'sine') // descending sound
      if (manualText) {
        setConsoleLogs(prev => [...prev, `[SUCCESS] ${manualText}`, '>> GRAVITATIONAL FORCES RESTORED TO 9.81 m/s².'])
      }
    }
  }, [antigravity])

  // ----------------------------------------------------
  // UNIFIED SMART CLICK HANDLER
  // ----------------------------------------------------
  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    clickCountRef.current += 1
    
    if (clickCountRef.current === 1) {
      timerRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) {
          // 1-Click: Standard home navigation (unless disabled on login/signup)
          if (!disableLink) {
            playSynthSound([880], 0.08, 'sine') // light chic sound
            router.push('/projects')
          } else {
            playSynthSound([330], 0.15, 'triangle') // tiny denied block beep
          }
        } else if (clickCountRef.current === 5) {
          // 5-Clicks: Toggle Antigravity Floating Mode!
          toggleAntigravity()
        } else if (clickCountRef.current >= 2) {
          // 2-4 Clicks: Boot Diagnostics Shell Console!
          bootConsole()
        }
        clickCountRef.current = 0
      }, 250) // 250ms double-click wait threshold
    }
  }

  // ----------------------------------------------------
  // SHELL COMMAND ENGINE & MINI-GAME
  // ----------------------------------------------------
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCmd = inputVal.trim().toLowerCase()
    if (!cleanCmd) return
    
    playSynthSound([440], 0.05, 'triangle') // typing feedback
    setConsoleLogs(prev => [...prev, `> ${inputVal}`])
    setInputVal('')
    
    // Decryption Game Input Parser
    if (decryptionNode?.active && !decryptionNode.solved) {
      if (cleanCmd === decryptionNode.code) {
        playSynthSound([523, 659, 783, 1046], 0.4, 'sine')
        setDecryptionNode(prev => prev ? { ...prev, solved: true } : null)
        setConsoleLogs(prev => [
          ...prev,
          '[SUCCESS] CODE CORRECT! RE-ROUTING GATEWAY...',
          '==================================================',
          'SECRET DATA DECRYPTED: ANTIGRAVITY ENGINE SECURED.',
          'Google DeepMind Pair Programmer Note:',
          '  "Antigravity is built on clean, reactive code.',
          '  Aesthetics are the heartbeat of standard platforms."',
          '=================================================='
        ])
      } else {
        const nextAttempts = decryptionNode.attempts + 1
        playSynthSound([220, 180], 0.25, 'sawtooth')
        if (nextAttempts >= 4) {
          setDecryptionNode(null)
          setConsoleLogs(prev => [
            ...prev,
            '[ERR] ALARM TRIGGERED. BRUTE FORCE ATTEMPT FAILED.',
            '>> Node reset. Core secured.'
          ])
        } else {
          setDecryptionNode(prev => prev ? { ...prev, attempts: nextAttempts } : null)
          setConsoleLogs(prev => [
            ...prev,
            `[ERR] SECURE PIN REJECTED. ATTEMPTS: ${nextAttempts}/4`,
            'Hint: The binary equivalent is odd. Guess again.'
          ])
        }
      }
      return
    }

    // Standard CLI Parser
    switch (cleanCmd) {
      case 'help':
        setConsoleLogs(prev => [
          ...prev,
          'Available Commands:',
          '  help        - Display commands guide.',
          '  scan        - Scan all local database schemas and memory banks.',
          '  decrypt     - Launch terminal security node bypass minigame.',
          '  antigravity - Engages anti-gravitational layout mode.',
          '  clear       - Clean the shell console output.',
          '  mute        - Toggle audio synth clicks.',
          '  exit        - Close quantum shell console.'
        ])
        break
      case 'scan':
        setConsoleLogs(prev => [
          ...prev,
          '-- INITIATING FULL DB DEEP SCAN --',
          '[OK] users            (Supabase Auth Active)',
          '[OK] deals            (RLS Access Contrained)',
          '[OK] deal_fields      (Nested Join Optimization)',
          '[OK] profiles         (acq_theme: green_mode)',
          '>> NO MEMORY LEAKS OR ANOMALIES DETECTED.'
        ])
        break
      case 'decrypt':
        // Generate a random hex code game
        const codes = ['3af2', 'b8c1', 'f9a2', 'd7e5', '0c9d']
        const targetCode = codes[Math.floor(Math.random() * codes.length)]!
        setDecryptionNode({
          active: true,
          code: targetCode,
          attempts: 0,
          solved: false
        })
        setConsoleLogs(prev => [
          ...prev,
          '-- SECURITY BYPASS SEQUENCE ENGAGED --',
          'Local firewall encryption node locked.',
          `Decrypt target hexadecimal code: "${targetCode}"`,
          'Type the exact pin above to override encryption gates.'
        ])
        break
      case 'antigravity':
        toggleAntigravity('MANUAL CONSOLE CMD: toggle_antigravity')
        break
      case 'clear':
        setConsoleLogs([])
        break
      case 'mute':
        setMuted(m => !m)
        setConsoleLogs(prev => [...prev, `[SYS] Web Audio Synth Muted: ${!muted ? 'YES' : 'NO'}`])
        break
      case 'exit':
        setEggActive(false)
        break
      default:
        setConsoleLogs(prev => [...prev, `[ERR] Command "${cleanCmd}" not found. Type "help" for valid options.`])
    }
  }

  // ----------------------------------------------------
  // LOGO VIEW LAYOUT COMPOSITIONS
  // ----------------------------------------------------
  const renderLogoBody = () => {
    if (variant === 'icon') {
      return <BuildingMark className={`h-6 w-6 ${className}`} />
    }

    if (variant === 'wordmark') {
      return (
        <div className={`flex items-center gap-2.5 ${className}`}>
          <BuildingMark className="h-6 w-6 shrink-0" />
          <span
            className="text-[16px] font-semibold leading-none tracking-tight transition-all duration-300 hover:tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {BRAND.name}
          </span>
        </div>
      )
    }

    // Default Full variant with taglines
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <BuildingMark className="h-7 w-7 shrink-0" />
        <div className="flex flex-col text-left">
          <span
            className="text-[18px] font-semibold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            {BRAND.name}
          </span>
          <span className="text-[9px] uppercase tracking-[0.15em] leading-tight font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
            {BRAND.tagline}
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Zero Gravity Particles overlay canvas inside the viewport */}
      {antigravity && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none z-[999] opacity-40"
        />
      )}

      {/* Main Trigger Container */}
      <Tooltip content="Click to route Home | Double-click for shell | 5 Clicks for Zero-G Mode">
        <div
          onClick={handleLogoClick}
          className="select-none cursor-pointer inline-block animate-hover"
        >
          {renderLogoBody()}
        </div>
      </Tooltip>

      {/* Quantum Diagnostics Console Overlay */}
      {eggActive && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-[6px] z-[9999] flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-xl border p-5 font-mono text-xs overflow-hidden shadow-2xl relative flex flex-col h-[400px]"
            style={{
              background: 'rgba(12, 18, 28, 0.96)',
              borderColor: 'var(--accent)',
              boxShadow: '0 0 30px rgba(16, 185, 129, 0.25)'
            }}
          >
            {/* CRT Grid Background */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] [background-size:100%_4px,6px_100%]" />

            {/* Console Header Bar */}
            <div className="flex items-center justify-between border-b pb-2.5 mb-3" style={{ borderColor: 'rgba(16, 185, 129, 0.25)' }}>
              <div className="flex items-center gap-2" style={{ color: '#10b981' }}>
                <Terminal className="h-4 w-4 animate-pulse" />
                <span className="font-semibold text-xs tracking-wider">ACQ_QUANT_SYSTEM v2.0</span>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip content={muted ? 'Unmute Synth Sounds' : 'Mute Synth Sounds'} position="bottom">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMuted(m => !m) }}
                    className="p-1 rounded hover:bg-white/5 transition-colors"
                    style={{ color: '#10b981' }}
                  >
                    {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                </Tooltip>
                <button
                  onClick={(e) => { e.stopPropagation(); setEggActive(false) }}
                  className="p-1 rounded hover:bg-white/5 transition-colors"
                  style={{ color: '#10b981' }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Console Output logs */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto space-y-1.5 pr-1.5 custom-scrollbar text-left scroll-smooth"
              style={{ color: '#4AF626' }}
            >
              {consoleLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed whitespace-pre-wrap break-all ${
                    log.startsWith('[SUCCESS]') ? 'text-emerald-400 font-bold' :
                    log.startsWith('[ERR]') ? 'text-red-400 font-bold' :
                    log.startsWith('>') ? 'text-teal-300 font-medium' : 'text-[#4AF626]/90'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>

            {/* Console Command Input Form */}
            <form
              onSubmit={handleCommandSubmit}
              className="mt-3 flex items-center border-t pt-2.5 gap-2"
              style={{ borderColor: 'rgba(16, 185, 129, 0.2) '}}
            >
              <span className="text-[12px] font-bold text-teal-300 select-none">{`>`}</span>
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="type help, scan, decrypt, antigravity, clear..."
                className="flex-1 bg-transparent border-0 outline-none text-[12px] p-0 font-mono text-[#4AF626] placeholder-[#10b981]/40 focus:ring-0 focus:outline-none"
                autoFocus
              />
            </form>
          </div>
        </div>
      )}
    </>
  )
}
