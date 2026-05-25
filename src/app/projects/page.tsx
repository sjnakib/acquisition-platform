'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Plus, FolderKanban, Users, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  sponsors: [{ count: number }] | null
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'internal' | 'client' | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.auth.getUser(),
      fetch('/api/projects').then((r) => r.json()),
    ])
      .then(([{ data: { user } }, data]) => {
        const r = (user?.app_metadata?.role as 'internal' | 'client') ?? 'internal'
        setRole(r)
        const list = (data ?? []) as Project[]
        setProjects(list)

        if (r === 'client' && list.length === 1) {
          router.replace(`/projects/${list[0]!.id}/overview`)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [router, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-canvas)' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Client with no projects
  if (role === 'client' && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3" style={{ background: 'var(--color-canvas)' }}>
        <p style={{ color: 'var(--color-text-primary)' }} className="text-lg font-semibold">No projects available</p>
        <p style={{ color: 'var(--color-text-secondary)' }} className="text-sm">Contact your account manager for access.</p>
      </div>
    )
  }

  // Client with multiple projects
  if (role === 'client' && projects.length > 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8" style={{ background: 'var(--color-canvas)' }}>
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
          Select a Project
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}/overview`)}
              className="text-left p-5 rounded-lg border transition-all duration-150 hover:shadow-md cursor-pointer"
              style={{ background: 'var(--color-surface-0)', borderColor: 'var(--color-border)' }}
            >
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}>
                {p.name}
              </h3>
              {p.description && (
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{p.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Internal user: show project management view
  return (
    <div className="pt-4 px-8 pb-8 max-lg:px-6 max-md:px-4 max-md:pt-2">
        <PageHeader title="Projects" description="Select or create a project to get started" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}/dashboard`)}
              className="group text-left p-5 rounded-lg border transition-all duration-300 ease-[var(--ease-fluid)] hover:shadow-md hover:-translate-y-[2px] cursor-pointer"
              style={{
                background: 'var(--color-surface-0)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ease-[var(--ease-spring)] group-hover:scale-105"
                  style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
                >
                  <FolderKanban size={20} />
                </div>
                <ArrowRight
                  size={16}
                  className="transition-all duration-300 ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:text-[var(--accent)]"
                  style={{ color: 'var(--color-text-tertiary)' }}
                />
              </div>
              <h3
                className="font-semibold text-sm mb-1"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-dm-sans)' }}
              >
                {p.name}
              </h3>
              {p.description && (
                <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                  {p.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {p.sponsors?.[0]?.count ?? 0} sponsor{(p.sponsors?.[0]?.count ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}

          <button
            onClick={() => setCreateOpen(true)}
            className="group text-left p-5 rounded-lg border-2 border-dashed transition-all duration-300 ease-[var(--ease-fluid)] hover:border-[var(--accent)] hover:-translate-y-[2px] cursor-pointer flex flex-col items-center justify-center min-h-[160px]"
            style={{
              background: 'var(--color-surface-0)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ease-[var(--ease-spring)] group-hover:scale-110"
              style={{ background: 'var(--color-surface-1)', color: 'var(--color-text-secondary)' }}
            >
              <Plus size={20} className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:rotate-90 group-hover:text-[var(--accent)]" />
            </div>
            <span className="text-sm font-medium transition-colors duration-300 group-hover:text-[var(--color-text-primary)]" style={{ color: 'var(--color-text-secondary)' }}>
              New Project
            </span>
          </button>
        </div>

        <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
  )
}
