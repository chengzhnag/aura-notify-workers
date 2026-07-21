import React from 'react';
import { cn } from '@/lib/utils';
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 sm:mb-8 sm:pb-6 border-b border-border/50", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm sm:text-base text-pretty max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex items-center shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}