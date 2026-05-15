import { CoStarImportWizard } from '@/components/import/CoStarImportWizard';
import { PageHeader } from '@/components/shared/PageHeader';

export default function ImportPage() {
 return (
 <div className="container mx-auto py-8">
 <PageHeader
 title="CoStar Bulk Import"
 description="Upload an Excel file from CoStar to import new deals into the pipeline."
 />
 <div className="mt-8">
 <CoStarImportWizard />
 </div>
 </div>
 );
}
