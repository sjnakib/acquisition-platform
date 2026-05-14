interface PageHeaderProps {
    title: string;
    description?: string;
  }
  
  export function PageHeader({ title, description }: PageHeaderProps) {
    return (
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
    );
  }
  