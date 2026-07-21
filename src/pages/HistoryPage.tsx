import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiWithMeta } from '@/lib/api-client';
import { ApiResponse, NotificationExecutionLog } from '@shared/types';
import { format } from 'date-fns';
import { History, RefreshCw, CheckCircle, XCircle, Trash2, Plus, Clock, Info, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
export function HistoryPage() {
  const queryClient = useQueryClient();
  const PAGE_SIZE = 10;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [selectedLog, setSelectedLog] = useState<NotificationExecutionLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [logs, setLogs] = useState<NotificationExecutionLog[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDetail = (log: NotificationExecutionLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const loadPage = useCallback(async (nextPage: number, reset = false) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const { data, meta } = await apiWithMeta<NotificationExecutionLog[]>(`/api/logs?page=${nextPage}&pageSize=${PAGE_SIZE}`);
      const items = data ?? [];
      const totalPages = meta?.totalPages ?? 1;
      setLogs((prev) => (reset ? items : [...prev, ...items]));
      setHasMore(nextPage < totalPages);
      setPage(nextPage);
    } catch (err) {
      if (reset) {
        setError(err instanceof Error ? err.message : '无法加载执行历史');
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

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        void loadPage(page + 1, false);
      }
    }, { rootMargin: '240px 0px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadPage, page]);

  const clearHistoryMutation = useMutation({
    mutationFn: () => api('/api/logs?before=2099-12-31%2023:59:59', { method: 'DELETE' }),
    onSuccess: (res: any) => {
      toast.success(res.message || '执行历史已成功清理');
      setLogs([]);
      setPage(1);
      setHasMore(true);
      queryClient.invalidateQueries({ queryKey: ['global-history'] });
      queryClient.invalidateQueries({ queryKey: ['system-stats'] });
    },
    onError: (err: Error) => toast.error(`清理失败: ${err.message}`),
  });
  const safeFormatDate = (timestamp: number | string | undefined | null) => {
    if (timestamp === null || timestamp === undefined) return '待处理';
    const value = typeof timestamp === 'string' ? timestamp : Number(timestamp);
    const date = new Date(value);
    if (isNaN(date.getTime())) return '日期异常';
    try {
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return '格式错误';
    }
  };

  const formatDetailValue = (value: unknown) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '—';
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return trimmed;
      }
    }
    return JSON.stringify(value, null, 2);
  };

  // 骨架屏组件
  const LogSkeleton = () => (
    <div className="grid grid-cols-1 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-card border border-border/50 rounded-3xl">
          <div className="flex items-start sm:items-center gap-5 min-w-0 flex-1">
            <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-5 w-40 rounded-lg" />
                <Skeleton className="h-5 w-12 rounded-lg" />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderLogs = () => {
    if (isLoading) {
      return <LogSkeleton />;
    }
    if (error) {
      return (
        <EmptyState
          icon={<XCircle className="h-12 w-12 text-destructive" />}
          title="数据加载失败"
          description={error}
          action={<Button onClick={() => void loadPage(1, true)} variant="outline" className="rounded-2xl px-8 h-12 font-bold shadow-sm">尝试重新同步</Button>}
        />
      );
    }
    if (!logs || logs.length === 0) {
      return (
        <EmptyState
          icon={<History className="h-12 w-12 text-muted-foreground/10" />}
          title="推送记录空空如也"
          description="系统会自动记录并持久化所有通知推送动作。配置任务并触发后，流水将在此显示。"
          action={
            <Button asChild className="btn-gradient px-8 py-6 rounded-2xl shadow-soft font-bold">
              <Link to="/tasks"><Plus className="mr-2 h-4 w-4" /> 运行首个任务</Link>
            </Button>
          }
        />
      );
    }
    return (
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence initial={false} mode="popLayout">
          {logs.map((log, idx) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.4) }}
              className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-card border border-border/50 rounded-3xl hover:shadow-lg hover:border-primary/40 transition-all duration-300 cursor-pointer"
              onClick={() => openDetail(log)}
            >
              <div className="flex items-start sm:items-center gap-5 min-w-0 flex-1">
                <div className={`p-3 rounded-2xl shrink-0 shadow-sm transition-all group-hover:rotate-6 ${log.status === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  {log.status === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display font-black text-foreground text-sm sm:text-base flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
                      {safeFormatDate(log.executed_at)}
                    </span>
                    <Badge
                      className={`text-[9px] py-0 px-2 font-black uppercase rounded-lg tracking-widest shadow-sm border-0 ${log.status === 'success' ? 'bg-success text-white hover:bg-success' : 'bg-destructive text-white hover:bg-destructive animate-pulse'}`}
                    >
                      {log.status === 'success' ? '成功' : '失败'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="opacity-40 font-black uppercase text-[10px] tracking-tight shrink-0">任务主体:</span>
                      <span className="text-foreground font-extrabold truncate max-w-[200px]">
                        {log.task_name || `ID:${String(log.task_id)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="opacity-40 font-black uppercase text-[10px] tracking-tight shrink-0">分发渠道:</span>
                      <span className="font-extrabold text-foreground/70 truncate max-w-[200px]">
                        {log.channel_name || (log.channel_id ? `UNLINKED (${String(log.channel_id)})` : 'UNKNOWN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={loadMoreRef} className="mt-2 flex min-h-10 items-center justify-center text-sm text-muted-foreground">
          {isLoadingMore ? '正在加载更多...' : !hasMore && logs.length > 0 ? '已经到底了' : null}
        </div>
      </div>
    );
  };
  return (
    <AppLayout container>
      <PageHeader
        title="全量执行流水"
        description="系统级别的分发轨迹监控。在此追踪每一个推送动作的响应耗时、最终状态以及故障节点详情。"
        action={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => { void loadPage(1, true); }}
              disabled={isLoading}
              className="rounded-2xl px-6 border-border/50 h-12 font-bold shadow-sm active:scale-95 transition-all bg-background"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''} text-primary`} />
              同步最新
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="lg"
                  className="rounded-2xl px-6 text-destructive h-12 font-bold hover:bg-destructive/5"
                  disabled={!logs || logs.length === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  彻底清理
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent className="rounded-3xl border-border/50">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl">确认销毁历史执行记录？</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm">
                    此操作无法撤销。是否继续？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="">
                  <AlertDialogCancel className="rounded-xl h-11 px-6">保留记录</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearHistoryMutation.mutate()}
                    className="bg-destructive text-white hover:bg-destructive/90 rounded-xl h-11 px-6 font-bold"
                  >
                    确认永久销毁
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />
      <div className="relative min-h-[500px]">
        {renderLogs()}
      </div>

      {/* 详情弹窗 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] rounded-[1.25rem] border-border/60 p-3 sm:max-w-2xl sm:rounded-[2rem] sm:p-6" style={{ maxHeight: '80vh' }}>
          <DialogHeader className="space-y-1 px-1 sm:px-0 pb-2 pt-4 border-b border-border/40">
            <div className="flex items-center">
              <DialogTitle className="text-lg font-black sm:text-xl">执行详情</DialogTitle>
              <Badge
                className={`text-[9px] py-0 px-3 ml-6 font-black uppercase rounded-lg tracking-widest shadow-sm border-0 ${selectedLog?.status === 'success' ? 'bg-success text-white' : 'bg-destructive text-white animate-pulse'}`}
              >
                {selectedLog?.status === 'success' ? '成功' : '失败'}
              </Badge>
            </div>
            <DialogDescription className="text-xs leading-5 sm:text-sm" style={{textAlign: 'left'}}>
              查看本次推送的完整执行信息、原始响应和错误原因。
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="mt-4 space-y-3 text-sm sm:space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 160px)' }}>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">任务 ID</p>
                  <p className="mt-1 break-all font-semibold">{selectedLog.task_id ?? '—'}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">渠道 ID</p>
                  <p className="mt-1 break-all font-semibold">{selectedLog.channel_id ?? '—'}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">任务名称</p>
                  {selectedLog.task_id ? (
                    <Link
                      to={`/tasks/${selectedLog.task_id}`}
                      className="flex items-center gap-2 text-primary hover:text-primary/80 hover:underline font-semibold transition-colors"
                    >
                      {selectedLog.task_name || `ID:${String(selectedLog.task_id)}`}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <p className="font-semibold italic opacity-50">已销毁</p>
                  )}
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">渠道名称</p>
                  <p className="mt-1 break-all font-semibold">{selectedLog.channel_name || '—'}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">计划执行时间</p>
                  <p className="mt-1 break-all font-semibold">{safeFormatDate(selectedLog.scheduled_time)}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">实际执行时间</p>
                  <p className="mt-1 break-all font-semibold">{safeFormatDate(selectedLog.executed_at)}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">原始响应</p>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-background/80 p-3 text-[11px] font-mono">{formatDetailValue(selectedLog.response)}</pre>
              </div>
              <div className="rounded-2xl border border-border/40 bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">错误信息</p>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-background/80 p-3 text-[11px] font-mono">{formatDetailValue(selectedLog.error_message)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}