import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CardWithActions } from '@/components/shared/CardWithActions';
import { EmptyState } from '@/components/shared/EmptyState';
import { ChannelSkeletonLoader } from '@/components/shared/ChannelSkeletonLoader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageCircle, Plus, Mail, Edit, Trash2, Loader, Bell, MessageSquareDot } from 'lucide-react';
import { AiOutlineDingding } from "react-icons/ai";
import { FaTelegramPlane, FaWeixin } from "react-icons/fa";
import { LuBird } from "react-icons/lu";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiWithMeta } from '@/lib/api-client';
import { ApiResponse, NotificationChannel } from '@shared/types';
import { CHANNEL_TYPE_LABELS, CHANNEL_TYPES } from '@shared/constants';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
const CHANNEL_ICONS: Record<string, any> = {
  [CHANNEL_TYPES.DINGTALK]: AiOutlineDingding,
  [CHANNEL_TYPES.FEISHU]: LuBird,
  [CHANNEL_TYPES.TELEGRAM]: FaTelegramPlane,
  [CHANNEL_TYPES.RESEND]: Mail,
  [CHANNEL_TYPES.WXPUSH]: FaWeixin,
  [CHANNEL_TYPES.WXPUSHER]: Bell,
  [CHANNEL_TYPES.PUSHME]: MessageSquareDot,
};
const CHANNEL_COLORS: Record<string, string> = {
  [CHANNEL_TYPES.DINGTALK]: 'text-blue-500 bg-blue-500/10',
  [CHANNEL_TYPES.FEISHU]: 'text-cyan-500 bg-cyan-500/10',
  [CHANNEL_TYPES.TELEGRAM]: 'text-sky-500 bg-sky-500/10',
  [CHANNEL_TYPES.RESEND]: 'text-indigo-500 bg-indigo-500/10',
  [CHANNEL_TYPES.WXPUSH]: 'text-green-500 bg-green-500/10',
  [CHANNEL_TYPES.WXPUSHER]: 'text-violet-500 bg-violet-500/10',
  [CHANNEL_TYPES.PUSHME]: 'text-emerald-500 bg-emerald-500/10',
};
const translateChannelType = (type: string) => CHANNEL_TYPE_LABELS[type] || type;
export function NotificationChannelsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 15;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [channelToDelete, setChannelToDelete] = useState<number | null>(null);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 当前操作的渠道信息
  const [currentChannel, setCurrentChannel] = useState<NotificationChannel | null>(null);

  const loadPage = useCallback(async (nextPage: number, reset = false) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const { data, meta } = await apiWithMeta<NotificationChannel[]>(`/api/channels?page=${nextPage}&pageSize=${PAGE_SIZE}`);

      const items = data ?? [];
      const totalPages = meta?.totalPages ?? 1;
      setChannels((prev) => (reset ? items : [...prev, ...items]));
      setHasMore(nextPage < totalPages);
      setPage(nextPage);
    } catch (err) {
      if (reset) {
        setError(err instanceof Error ? err.message : '无法加载渠道列表');
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadPage(page + 1, false);
        }
      },
      { rootMargin: '240px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadPage, page]);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/api/channels/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('渠道已删除');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setChannelToDelete(null);
      void loadPage(1, true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      api(`/api/channels/${id}/toggle`, { method: 'PATCH' }),
    onSuccess: (_data, { id }: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setChannels((prev) => prev.map((channel) => (channel.id === id ? { ...channel, is_active: channel.is_active ? 0 : 1 } : channel)));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout container>
      <PageHeader
        title="通知渠道"
        description="配置您的外部提醒接收端，如钉钉、飞书及电报。"
        action={
          <Button onClick={() => navigate('/channels/new')} className="btn-gradient">
            <Plus className="mr-2 h-4 w-4" /> 创建渠道
          </Button>
        }
      />
      {isLoading ? (
        <ChannelSkeletonLoader count={6} />
      ) : error ? (
        <EmptyState
          icon={<MessageCircle className="h-12 w-12 text-destructive" />}
          title="出错了"
          description={error}
          action={<Button variant="outline" onClick={() => void loadPage(1, true)}>重试</Button>}
        />
      ) : channels.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-12 w-12 text-muted-foreground/30" />}
          title="暂无渠道"
          description="添加您的第一个通知渠道以接收提醒。"
          action={<Button className="btn-gradient" onClick={() => navigate('/channels/new')}><Plus className="mr-2 h-4 w-4" /> 创建渠道</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {channels.map((channel) => {
              const Icon = CHANNEL_ICONS[channel.type] || MessageCircle;
              const colorClass = CHANNEL_COLORS[channel.type] || 'bg-muted';
              return (
                <CardWithActions
                  key={channel.id}
                  title={channel.name}
                  description={
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{translateChannelType(channel.type)}</span>
                      </div>
                    </div>
                  }
                  actions={
                    <div className="flex items-center justify-between w-full pt-1">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={channel.is_active === 1}
                          onCheckedChange={() => {
                            setCurrentChannel(channel);
                            toggleStatusMutation.mutate({ id: channel.id });
                          }}
                          className="data-[state=checked]:bg-success"
                        />
                        <span className={`text-xs font-bold transition-colors ${channel.is_active === 1 ? 'text-success' : 'text-muted-foreground'}`}>
                          {channel.is_active === 1 ? '已启用' : '已禁用'}
                        </span>
                        {toggleStatusMutation.isPending && currentChannel?.id === channel.id && <Loader className="mr-2 h-5 w-5 animate-spin" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/channels/${channel.id}/edit`)}>
                          <Edit className="h-4 w-4 mr-1" /> 编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setChannelToDelete(channel.id)}>
                          <Trash2 className="h-4 w-4" /> 删除
                        </Button>
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
          <div ref={loadMoreRef} className="mt-6 flex min-h-10 items-center justify-center text-sm text-muted-foreground">
            {isLoadingMore ? '正在加载更多...' : !hasMore && channels.length > 0 ? '全部加载完成' : null}
          </div>
        </>
      )}
      <AlertDialog open={!!channelToDelete} onOpenChange={(open) => !open && setChannelToDelete(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除此渠道吗？</AlertDialogTitle>
            <AlertDialogDescription>
              这将永久删除该配置。该渠道将从所有关联的通知任务中自动移除，可能导致部分任务无法成功发送通知。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => channelToDelete && deleteMutation.mutate(channelToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}