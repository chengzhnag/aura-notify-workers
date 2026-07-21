import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ChannelSkeletonLoaderProps {
  count?: number;
}

/**
 * 渠道列表骨架屏
 * 贴合 NotificationChannelsPage 中 CardWithActions 的样式
 */
export function ChannelSkeletonLoader({ count = 6 }: ChannelSkeletonLoaderProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border/50 rounded-2xl p-4 sm:p-6 flex flex-col h-full">
          {/* 卡片标题 */}
          <Skeleton className="h-6 w-3/4 rounded-md mb-4" />

          {/* 渠道类型信息 */}
          <div className="space-y-4 mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="pt-3 sm:pt-4 border-t border-border/40 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-9 rounded-full" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
