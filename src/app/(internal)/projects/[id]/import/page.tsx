import { CoStarImportWizard } from '@/components/import/CoStarImportWizard'
import { PageHeader } from '@/components/shared/PageHeader'
import { pageHeadings } from '@/lib/page-headings'

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div>
      <PageHeader
        title={pageHeadings.import.title}
        description={pageHeadings.import.description}
      />
      <CoStarImportWizard />
    </div>
  )
}
