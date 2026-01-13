/**
 * Standard Page Header
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex items-center justify-between mb-24">
      <div className="flex flex-col gap-6">
        <div className="flex gap-8 items-center">
          {Icon && <Icon className="size-24 text-icon-primary" />}
          <h1
            className="text-h3 font-bold text-text-primary"
            data-editable="true"
            data-element-id="page-title"
          >
            {title}
          </h1>
        </div>
        {description && (
          <p className="text-text-secondary text-body-m">{description}</p>
        )}
      </div>
      {children && <div className="flex gap-8">{children}</div>}
    </div>
  );
}
