import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { NotificationTask, NotificationExecutionLog, NotificationChannel } from '@shared/types';
import { DATE_TYPE_LABELS, DATE_TYPES, TASK_TYPE_LABELS, TASK_TYPES, TASK_STATUS, TASK_STATUS_LABELS } from '@shared/constants';
import { BellRing, Edit, Play, History, Loader2, ArrowLeft, CheckCircle2, XCircle, Activity, Zap, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
export function TaskDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const { data: task, isLoading: isTaskLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api<NotificationTask>(`/api/tasks/${id}`),
  });
  const { data: history = [], isLoading: isHistoryLoading } = useQuery<NotificationExecutionLog[]>({
    queryKey: ['tasks', id, 'history'],
    queryFn: () => api<NotificationExecutionLog[]>(`/api/logs?task_id=${id}&page=1&pageSize=50`),
  });
  const { data: channelsData = [], isLoading: isChannelsLoading } = useQuery<NotificationChannel[]>({
    queryKey: ['channels'],
    queryFn: () => api<NotificationChannel[]>('/api/channels'),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const result = await api<{
        total: number;
        success: number;
        failed: number;
        results: { channelId: number; channelName: string; success: boolean; error?: string }[];
      }>(`/api/tasks/${id}/trigger`, { method: 'POST' });
      return result;
    },
    onSuccess: (result) => {
      if (result.failed > 0) {
        toast.error(`发送完成：${result.success} 成功，${result.failed} 失败`);
      } else {
        toast.success(`已向 ${result.total} 个渠道发送通知`);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', id, 'history'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || '触发失败，请稍后重试');
    },
  });

  const formatId = (value?: string | number | null) => {
    if (value === undefined || value === null || value === '') return 'N/A';
    const text = String(value);
    return text.length > 8 ? text.slice(0, 8) : text;
  };

  const getTaskTypeLabel = (type?: string) => TASK_TYPE_LABELS[type || ''] || '未知';

  const getDateTypeLabel = (type?: string) => DATE_TYPE_LABELS[type || DATE_TYPES.ALL] || '每天';

  const getFrequencyValues = (frequency?: string) => {
    try {
      const values = JSON.parse(frequency || '[]');
      return Array.isArray(values) ? values.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const getScheduleSummary = (taskItem: NotificationTask) => {
    if (taskItem.task_type === TASK_TYPES.SINGLE) {
      return taskItem.execute_date ? `执行日期 ${taskItem.execute_date}` : '未设置执行日期';
    }

    if (taskItem.task_type === TASK_TYPES.RECURRING) {
      const range = [taskItem.start_date, taskItem.end_date].filter(Boolean).join(' ~ ');
      return range ? `执行区间 ${range}` : '未设置执行区间';
    }

    return '长期循环执行';
  };

  if (isTaskLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!task) return <div className="p-8 text-center bg-background h-screen flex items-center justify-center">未找到该任务</div>;
  const parseChannelIds = (value?: string) => {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  };

  const channels = channelsData ?? [];
  const activeChannels = channels.filter(ch => parseChannelIds(task.channel_ids).includes(String(ch.id)));
  const activeChannelsCount = isChannelsLoading ? null : activeChannels.length;
  return (
    <AppLayout container>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full shrink-0 h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">{task.name}</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-mono uppercase tracking-widest mt-1">
              <Activity className="h-3 w-3" /> TASK ID: {formatId(task.id)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {task.status !== TASK_STATUS.FINISHED && (
            <Button variant="outline" asChild className="rounded-xl border-border/50 h-10 px-5 font-bold">
              <Link to={`/tasks/${id}/edit`}><Edit className="h-4 w-4 mr-2" /> 编辑配置</Link>
            </Button>
          )}
          <Button
            className="btn-gradient rounded-xl h-10 px-5 font-bold shadow-soft"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || task.status === TASK_STATUS.FINISHED}
          >
            {runMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            手动触发
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-border/50 shadow-soft overflow-hidden rounded-3xl">
            <CardHeader className="bg-muted/20 border-b border-border/50 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest opacity-60">任务运行配置</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { label: '运行状态', value: task.status === TASK_STATUS.FINISHED ? '已结束' : (task.status === TASK_STATUS.ACTIVE ? '运行中' : '已暂停'), color: task.status === TASK_STATUS.FINISHED ? 'text-amber-500' : (task.status === TASK_STATUS.ACTIVE ? 'text-success' : 'text-muted-foreground') },
                  { label: '调度模式', value: getTaskTypeLabel(task.task_type), color: 'text-primary' },
                  { label: '触发时刻', value: getFrequencyValues(task.frequency).join(' / ') || '—', color: 'text-foreground' },
                  { label: '过滤模式', value: getDateTypeLabel(task.date_types), color: 'text-foreground' }
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-secondary/30 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-40 mb-1.5">{item.label}</p>
                    <p className={cn("text-sm font-bold", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4 space-y-3">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">任务描述</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.description || '这个任务还没有添加描述。'}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4 space-y-3">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">执行详情</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">执行范围</span><span className="font-semibold text-foreground text-right">{getScheduleSummary(task)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">创建时间</span><span className="font-semibold text-foreground">{task.created_at ? format(new Date(task.created_at), 'yyyy-MM-dd HH:mm') : '—'}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">更新时间</span><span className="font-semibold text-foreground">{task.updated_at ? format(new Date(task.updated_at), 'yyyy-MM-dd HH:mm') : '—'}</span></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest opacity-50">推送载体预览</p>
                <div className="bg-card border border-border/50 shadow-inner p-8 rounded-[2.5rem] relative group">
                  <div className="space-y-4">
                    <h2 className="font-display font-black text-xl border-b border-border/20 pb-4">{task.title || '未命名标题'}</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-sm">{task.content || '未配置推送正文'}</p>
                  </div>
                  <Zap className="absolute top-6 right-6 h-6 w-6 text-primary/10 group-hover:text-primary/20 transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 shadow-soft overflow-hidden rounded-3xl">
            <CardHeader className="bg-muted/20 border-b border-border/50 py-4 px-6">
              <CardTitle className="text-sm font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                <History className="h-4 w-4" /> 历史执行轨迹
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isHistoryLoading ? (
                <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-primary/20" /></div>
              ) : !history || history.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                  <History className="h-10 w-10" />
                  <p className="text-xs font-bold uppercase tracking-widest">暂无运行历史</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {history.map((log) => (
                    <div key={log.id} className="group hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}>
                        <div className="flex items-center gap-5 min-w-0">
                          <div className={cn("p-2.5 rounded-full shadow-sm", log.status === 'success' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                            {log.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold">{log.scheduled_time ? format(new Date(log.scheduled_time), 'yyyy-MM-dd HH:mm:ss') : '—'}</p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight truncate mt-0.5">
                              {log.channel_name || (log.channel_id ? `CHANNEL:${formatId(log.channel_id)}` : 'UNKNOWN CHANNEL')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-[10px] px-2 py-0 h-5 font-black uppercase rounded-lg">
                          {log.status === 'success' ? 'SUCCESS' : 'FAILED'}
                        </Badge>
                      </div>
                      <AnimatePresence>
                        {expandedLog === log.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-secondary/20 overflow-hidden"
                          >
                            <div className="p-6 border-t border-border/20">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">平台原始响应</p>
                              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground/80 leading-relaxed bg-black/5 dark:bg-white/5 p-4 rounded-xl shadow-inner">
                                {log.response || log.error_message || 'No detailed response message available.'}
                              </pre>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <Card className="border-primary/20 bg-primary/5 shadow-soft border-2 rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/10 border-b border-primary/10 py-5 px-6">
              <CardTitle className="text-[10px] uppercase font-black text-primary tracking-widest">生命周期摘要</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground font-bold">创建日期</span>
                <span className="text-xs font-black">{task.created_at ? format(new Date(task.created_at), 'yyyy-MM-dd HH:mm') : '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground font-bold">更新日期</span>
                <span className="text-xs font-black">{task.updated_at ? format(new Date(task.updated_at), 'yyyy-MM-dd HH:mm') : '—'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-primary/10 pt-4">
                <span className="text-xs text-muted-foreground font-bold">已关联渠道</span>
                {activeChannelsCount === null ? (
                  <Skeleton className="h-4 w-8 rounded-md" />
                ) : (
                  <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">{activeChannelsCount} 个活跃端点</span>
                )}
              </div>
              <div className="pt-2">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-3 opacity-50">端点名称</p>
                <div className="flex flex-wrap gap-2">
                  {isChannelsLoading ? (
                    <Skeleton className="h-6 w-full rounded-xl" />
                  ) : activeChannels.length > 0 ? (
                    activeChannels.map(ch => (
                      <Badge key={ch.id} variant="secondary" className="bg-card text-[10px] border-border/50 font-black px-3 py-1 rounded-xl shadow-sm lowercase tracking-tight">
                        {ch.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground italic font-medium">尚未关联任何推送渠道</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}