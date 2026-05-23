'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { z } from 'zod'
import { createProjectSchema, addSponsorSchema } from '@/lib/validations/project.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SponsorEntry {
  email: string
  full_name?: string
}

type FormValues = z.infer<typeof createProjectSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateProjectDialog({ open, onOpenChange }: Props) {
  const [sponsorsOpen, setSponsorsOpen] = useState(false)
  const [sponsors, setSponsors] = useState<SponsorEntry[]>([])
  const [sponsorEmail, setSponsorEmail] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [sponsorError, setSponsorError] = useState<string | null>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(createProjectSchema),
  })

  const addSponsor = () => {
    const parsed = addSponsorSchema.safeParse({ email: sponsorEmail, full_name: sponsorName || undefined })
    if (!parsed.success) {
      setSponsorError(parsed.error.flatten().fieldErrors.email?.[0] ?? 'Invalid sponsor')
      return
    }
    if (sponsors.some((s) => s.email.toLowerCase() === sponsorEmail.toLowerCase())) {
      setSponsorError('This email is already added')
      return
    }
    setSponsors([...sponsors, { email: sponsorEmail, full_name: sponsorName || undefined }])
    setSponsorEmail('')
    setSponsorName('')
    setSponsorError(null)
  }

  const removeSponsor = (email: string) => {
    setSponsors(sponsors.filter((s) => s.email !== email))
  }

  const onSubmit = async (data: FormValues) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, description: data.description || undefined }),
    })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to create project')
      return
    }

    const newProject = await res.json()

    if (sponsors.length > 0) {
      const results = await Promise.allSettled(
        sponsors.map((s) =>
          fetch(`/api/projects/${newProject.id}/sponsors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: s.email, full_name: s.full_name }),
          }).then(async (r) => {
            if (!r.ok) {
              const err = await r.json()
              throw new Error(err.error ?? 'Failed to add sponsor')
            }
          })
        )
      )
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        toast.error(`${failed.length} sponsor(s) could not be added`)
      }
    }

    queryClient.invalidateQueries({ queryKey: ['projects'] })
    toast.success('Project created')
    reset()
    setSponsors([])
    setSponsorsOpen(false)
    onOpenChange(false)
    router.push(`/projects/${newProject.id}/dashboard`)
  }

  const handleClose = () => {
    reset()
    setSponsors([])
    setSponsorsOpen(false)
    setSponsorEmail('')
    setSponsorName('')
    setSponsorError(null)
    onOpenChange(false)
  }

  const s = {
    label: { fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' } as const,
    hint: { fontSize: 12, color: 'var(--color-text-tertiary)' } as const,
    error: { fontSize: 12, color: 'var(--color-danger-text)' } as const,
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <DialogDescription style={{ color: 'var(--color-text-secondary)' }}>
            Create a new project to organize deals and collaborate with sponsors.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name" style={s.label}>Name</Label>
            <Input id="name" {...register('name')} placeholder="e.g. Q2 Industrial Portfolio" className="mt-1" />
            {errors.name && <p style={s.error}>{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="description" style={s.label}>Description</Label>
            <Input id="description" {...register('description')} placeholder="Optional project description" className="mt-1" />
            {errors.description && <p style={s.error}>{errors.description.message}</p>}
          </div>

          <button
            type="button"
            onClick={() => setSponsorsOpen(!sponsorsOpen)}
            className="flex items-center gap-1 text-[13px] font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {sponsorsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Sponsors {sponsors.length > 0 && `(${sponsors.length})`}
          </button>

          {sponsorsOpen && (
            <div className="space-y-3 pl-1">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={sponsorEmail}
                    onChange={(e) => { setSponsorEmail(e.target.value); setSponsorError(null) }}
                    placeholder="email@example.com"
                    type="email"
                    className="bg-[var(--color-surface-1)]"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    placeholder="Full name (optional)"
                    className="bg-[var(--color-surface-1)]"
                  />
                </div>
                <Button type="button" onClick={addSponsor} disabled={!sponsorEmail}>
                  <Plus size={14} />
                  Add
                </Button>
              </div>
              {sponsorError && <p style={s.error}>{sponsorError}</p>}
              <p style={s.hint}>You can add or remove sponsors later from the project settings.</p>

              {sponsors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sponsors.map((sp) => (
                    <span
                      key={sp.email}
                      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[13px] border"
                      style={{
                        background: 'var(--color-surface-1)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {sp.full_name ? `${sp.full_name} (${sp.email})` : sp.email}
                      <button
                        type="button"
                        onClick={() => removeSponsor(sp.email)}
                        className="rounded-sm hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
