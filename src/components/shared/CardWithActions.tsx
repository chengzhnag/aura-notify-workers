import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
interface CardWithActionsProps {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  loading?: boolean;
}
export function CardWithActions({ title, description, actions, className, loading = false }: CardWithActionsProps) {
  return (
    <Card className={cn("flex flex-col h-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border-border/50 group relative", className)}>
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
        <CardTitle className="text-lg font-display font-bold truncate group-hover:text-primary transition-colors">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 flex-1 flex flex-col justify-between sm:pt-4">
        <div className="mb-4">
          {description}
        </div>
        {actions && (
          <div className="pt-3 sm:pt-4 border-t border-border/40 flex justify-end">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}