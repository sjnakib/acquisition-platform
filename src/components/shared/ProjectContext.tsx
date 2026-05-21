'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface ProjectContextValue {
  projectId: string
  projectName: string
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ projectId, projectName, children }: ProjectContextValue & { children: ReactNode }) {
  return (
    <ProjectContext.Provider value={{ projectId, projectName }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used within a ProjectProvider')
  return ctx
}
