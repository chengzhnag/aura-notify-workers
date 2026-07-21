import React from 'react';
import { cn } from '@/lib/utils';
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-border/50 rounded-3xl bg-secondary/10 space-y-4",
      className
    )}>
      <div className="p-4 rounded-full bg-background shadow-sm ring-1 ring-border/20">
        {icon}
      </div>
      <div className="space-y-2 max-w-xs">
        <h3 className="text-xl font-display font-bold">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {action && (
        <div className="pt-2">
          {action}
        </div>
      )}
    </div>
  );
}