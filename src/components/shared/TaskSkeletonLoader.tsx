import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

interface TaskSkeletonLoaderProps {
  count?: number;
}

/**
 * 任务列表骨架屏
 * 贴合 NotificationTasksPage 中 CardWithActions 的样式
 */
export function TaskSkeletonLoader({ count = 6 }: TaskSkeletonLoaderProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border/50 rounded-2xl p-4 sm:p-6 flex flex-col h-full">
          {/* 卡片标题 */}
          <Skeleton className="h-6 w-3/4 rounded-md mb-4" />

          {/* 通知标题 */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-4 w-full rounded-md" />
          </div>

          {/* 任务描述 */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
          </div>

          {/* Badge 标签 */}
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          {/* 执行时段信息 */}
          <div className="bg-secondary/30 p-2.5 rounded-xl space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="pt-3 sm:pt-4 border-t border-border/40 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
