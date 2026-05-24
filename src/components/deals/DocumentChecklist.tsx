'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Plus, Check, X, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface DocItem {
  id: string
  deal_id: string
  doc_name: string
  collected: boolean
  metadata: Record<string, unknown>
  sort_order: number
  updated_at: string
}

export function DocumentChecklist({ dealId }: { dealId: string }) {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDocName, setNewDocName] = useState('')

  useEffect(() => {
    fetch(`/api/deals/${dealId}/documents`)
      .then((r) => r.json())
      .then((data) => setDocs(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Failed to load documents'))
      .finally(() => setLoading(false))
  }, [dealId])

  const toggleDoc = useCallback(async (doc: DocItem) => {
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, collected: !doc.collected } : d))
    try {
      await fetch(`/api/deals/${dealId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: doc.id, collected: !doc.collected }),
      })
    } catch {
      setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, collected: doc.collected } : d))
      toast.error('Failed to update')
    }
  }, [dealId])

  const addDoc = useCallback(async () => {
    if (!newDocName.trim()) return
    const name = newDocName.trim()
    setNewDocName('')
    setAdding(false)
    try {
      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_name: name }),
      })
      if (res.ok) {
        const created = await res.json()
        setDocs((prev) => [...prev, created])
      } else {
        toast.error('Failed to add document')
      }
    } catch {
      toast.error('Failed to add document')
    }
  }, [newDocName, dealId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  const collected = docs.filter((d) => d.collected).length
  const total = docs.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Document Checklist
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            {total > 0 ? `${collected} of ${total} collected` : 'No documents yet'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          className="h-7 text-[11px]"
        >
          <Plus size={12} />
          Add Doc
        </Button>
      </div>

      {total > 0 && (
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(collected / total) * 100}%`,
              background: collected === total ? 'var(--color-success)' : 'var(--color-accent)',
            }}
          />
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-2 p-2 rounded-md border" style={{ borderColor: 'var(--color-surface-3)', background: 'var(--color-surface-1)' }}>
          <Input
            value={newDocName}
            onChange={(e) => setNewDocName(e.target.value)}
            placeholder="Document name..."
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') addDoc(); if (e.key === 'Escape') setAdding(false) }}
            className="h-7 text-[12px] bg-[var(--color-surface-0)] border-[var(--color-surface-3)] flex-1"
          />
          <Button size="sm" onClick={addDoc} disabled={!newDocName.trim()} className="h-7 text-[11px] bg-[var(--color-accent)] border-none text-[var(--color-text-inverse)]">
            <Check size={12} /> Add
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="h-7 text-[11px]">
            <X size={12} />
          </Button>
        </div>
      )}

      <div className="space-y-1">
        {docs.map((doc) => (
          <button
            key={doc.id}
            onClick={() => toggleDoc(doc)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors group ${
              doc.collected
                ? 'bg-[var(--color-success-bg)] bg-opacity-30'
                : 'hover:bg-[var(--color-surface-1)]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                doc.collected
                  ? 'bg-[var(--color-success)] border-[var(--color-success)]'
                  : 'border-[var(--color-surface-3)]'
              }`}
            >
              {doc.collected && <Check size={11} style={{ color: '#fff' }} />}
            </div>
            <span
              className={`text-[13px] flex-1 ${doc.collected ? 'line-through opacity-60' : ''}`}
              style={{ color: 'var(--color-text-primary)' }}
            >
              {doc.doc_name}
            </span>
            {doc.metadata && Object.keys(doc.metadata).length > 0 && (
              <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {JSON.stringify(doc.metadata)}
              </span>
            )}
          </button>
        ))}
      </div>

      {total === 0 && !adding && (
        <div className="py-6 text-center">
          <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
            No documents. Click &quot;Add Doc&quot; to start tracking.
          </p>
        </div>
      )}
    </div>
  )
}
