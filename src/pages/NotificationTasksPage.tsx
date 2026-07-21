import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { CardWithActions } from '@/components/shared/CardWithActions';
import { EmptyState } from '@/components/shared/EmptyState';
import { TaskSkeletonLoader } from '@/components/shared/TaskSkeletonLoader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
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
import {
  BellRing, Plus, Clock, Calendar, Repeat, MoreHorizontal,
  Trash2, Edit, ChevronRight, Globe, Coffee, ListChecks, Loader, CheckCircle
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiWithMeta } from '@/lib/api-client';
import { ApiResponse, NotificationTask } from '@shared/types';
import { DATE_TYPE_LABELS, DATE_TYPES, TASK_TYPE_LABELS, TASK_TYPES, TASK_STATUS, TASK_STATUS_LABELS } from '@shared/constants';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { motion } from 'framer-motion';
export function NotificationTasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 15;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const [tasks, setTasks] = useState<NotificationTask[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 当前操作的任务信息
  const [currentTask, setCurrentTask] = useState<NotificationTask | null>(null);

  const loadPage = useCallback(async (nextPage: number, reset = false) => {
    if (reset) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const { data, meta } = await apiWithMeta<NotificationTask[]>(`/api/tasks?page=${nextPage}&pageSize=${PAGE_SIZE}`);

      const items = data ?? [];
      const totalPages = meta?.totalPages ?? 1;
      setTasks((prev) => (reset ? items : [...prev, ...items]));
      setHasMore(nextPage < totalPages);
      setPage(nextPage);
    } catch (err) {
      if (reset) {
        setError(err instanceof Error ? err.message : '无法加载任务列表');
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
    mutationFn: (id: number) => api(`/api/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      toast.success('任务已删除');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTasks((prev) => prev.filter((task) => task.id !== id));
      setTaskToDelete(null);
      setCurrentTask(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setCurrentTask(null);
    },
  });
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      api(`/api/tasks/${id}/status`, { method: 'PATCH' }),
    onSuccess: (_data, { id }: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: task.status === TASK_STATUS.ACTIVE ? TASK_STATUS.INACTIVE : TASK_STATUS.ACTIVE } : task)));
      setCurrentTask(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setCurrentTask(null);
    },
  });

  const finishTaskMutation = useMutation({
    mutationFn: (id: number) =>
      api(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: TASK_STATUS.FINISHED }),
      }),
    onSuccess: (_data, id) => {
      toast.success('任务已标记为结束');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status: TASK_STATUS.FINISHED } : task)));
      setCurrentTask(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setCurrentTask(null);
    },
  });

  const isFinished = (task: NotificationTask) => task.status === TASK_STATUS.FINISHED;
  const translateTaskType = (type: string) => TASK_TYPE_LABELS[type] || type;
  const getDateTypeLabel = (dateType: string) => DATE_TYPE_LABELS[dateType] || '每天';
  const getDateTypeIcon = (dateType: string) => {
    switch (dateType) {
      case DATE_TYPES.WORKDAY: return <Coffee className="h-3 w-3" />;
      case DATE_TYPES.HOLIDAY: return <Calendar className="h-3 w-3" />;
      default: return <Globe className="h-3 w-3" />;
    }
  };
  const getTimeValues = (frequency: string) => {
    try {
      const values = JSON.parse(frequency || '[]');
      return Array.isArray(values) ? values.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const getTimeLabel = (frequency: string) => {
    const values = getTimeValues(frequency);
    if (values.length > 4) {
      return (
        <HoverCard>
          <HoverCardTrigger>
            <span className="font-bold text-foreground">
              <span className='text-primary'>{values.length}</span>
              个时段
            </span>
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <div className="flex flex-col gap-1 text-sm text-foreground">
              {values.join(' / ')}
            </div>
          </HoverCardContent>
        </HoverCard>
      );
    }
    return values.length > 0 ? values.join(' / ') : '—';
  };

  const getScheduleLabel = (task: NotificationTask) => {
    if (task.task_type === TASK_TYPES.SINGLE) {
      return task.execute_date ? `单次执行 · ${task.execute_date}` : '单次执行';
    }

    if (task.task_type === TASK_TYPES.RECURRING) {
      const range = [task.start_date, task.end_date].filter(Boolean).join(' ~ ');
      return range ? `周期执行 · ${range}` : '周期执行';
    }

    return '长期执行';
  };

  const getChannelCount = (channelIds: string) => {
    try {
      const values = JSON.parse(channelIds || '[]');
      return Array.isArray(values) ? values.length : 0;
    } catch {
      return 0;
    }
  };
  return (
    <AppLayout container>
      <PageHeader
        title="通知任务"
        description="管理您的自动化通知及调度规则。所有时间均以本地时区为准。"
        action={
          <Button onClick={() => navigate('/tasks/new')} className="btn-gradient shadow-soft">
            <Plus className="mr-2 h-4 w-4" /> 创建任务
          </Button>
        }
      />
      {isLoading ? (
        <TaskSkeletonLoader count={6} />
      ) : error ? (
        <EmptyState
          icon={<BellRing className="h-12 w-12 text-destructive" />}
          title="出错了"
          description={error}
          action={<Button variant="outline" onClick={() => void loadPage(1, true)}>重试</Button>}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-12 w-12 text-muted-foreground/30" />}
          title="暂无任务"
          description="点击上方按钮创建您的第一个自动化通知。"
          action={<Button className="btn-gradient" onClick={() => navigate('/tasks/new')}><Plus className="mr-2 h-4 w-4" /> 创建任务</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task, idx) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <CardWithActions
                  loading={currentTask?.id === task.id && (deleteMutation.isPending || finishTaskMutation.isPending)}
                  className="cursor-pointer group hover:shadow-lg transition-all"
                  title={task.name}
                  description={
                    <div className="space-y-4" onClick={() => navigate(`/tasks/${task.id}`)}>
                      <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">通知标题</p>
                        <p className="text-sm font-semibold text-foreground line-clamp-2">{task.title || '未设置通知标题'}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">任务描述</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[1.6rem] group-hover:text-foreground transition-colors">
                          {task.description || '这个任务还没有添加描述。'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="rounded-full px-3 border-primary/20 text-primary flex items-center gap-1.5 bg-primary/5 transition-colors group-hover:bg-primary/10">
                          {task.task_type === TASK_TYPES.SINGLE ? <Clock className="h-3 w-3" /> : task.task_type === TASK_TYPES.RECURRING ? <Repeat className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
                          {translateTaskType(task.task_type)}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full px-3 flex items-center gap-1.5 opacity-80">
                          {getDateTypeIcon(task.date_types)}
                          {getDateTypeLabel(task.date_types)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-xs text-muted-foreground bg-secondary/30 p-2.5 rounded-xl border border-transparent group-hover:border-border/50 group-hover:bg-secondary/50 transition-all">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            <div className="flex items-center gap-1 text-muted-foreground/80">
                              <span className='whitespace-nowrap'>执行时段:</span>
                              <span className="font-bold text-foreground">{getTimeLabel(task.frequency)}</span>
                            </div>
                          </span>
                          <span className="font-medium whitespace-nowrap">{getChannelCount(task.channel_ids)} 个渠道</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{getScheduleLabel(task)}</span>
                        </div>
                      </div>
                    </div>
                  }
                  actions={
                    <div className="flex items-center justify-between w-full pt-1">
                      <div className="flex items-center gap-3">
                        {isFinished(task) ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-bold text-muted-foreground">已结束</span>
                          </div>
                        ) : (
                          <>
                            <Switch
                              checked={task.status === TASK_STATUS.ACTIVE}
                              onCheckedChange={() => {
                                setCurrentTask(task);
                                toggleStatusMutation.mutate({ id: task.id });
                              }}
                              className="data-[state=checked]:bg-success"
                            />
                            <span className={`text-xs font-bold transition-colors ${task.status === TASK_STATUS.ACTIVE ? 'text-success' : 'text-muted-foreground'}`}>
                              {task.status === TASK_STATUS.ACTIVE ? '已启用' : '已暂停'}
                            </span>
                          </>
                        )}
                        {toggleStatusMutation.isPending && currentTask?.id === task.id && <Loader className="mr-2 h-5 w-5 animate-spin" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl shadow-soft">
                            <DropdownMenuItem onClick={() => navigate(`/tasks/${task.id}`)} className="cursor-pointer">
                              <ChevronRight className="mr-2 h-4 w-4 text-primary" /> 查看详情与历史
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/tasks/${task.id}/edit`)}
                              disabled={isFinished(task)}
                              className={`cursor-pointer ${isFinished(task) ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              <Edit className="mr-2 h-4 w-4" /> 编辑任务配置
                            </DropdownMenuItem>
                            {!isFinished(task) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setCurrentTask(task);
                                    finishTaskMutation.mutate(task.id);
                                  }}
                                  disabled={finishTaskMutation.isPending}
                                  className="cursor-pointer text-amber-600 focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> 设置任务结束
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer"
                              onClick={() => {
                                setCurrentTask(task);
                                setTaskToDelete(task.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> 永久删除任务
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  }
                />
              </motion.div>
            ))}
          </div>
          <div ref={loadMoreRef} className="mt-6 flex min-h-10 items-center justify-center text-sm text-muted-foreground">
            {isLoadingMore ? '正在加载更多...' : !hasMore && tasks.length > 0 ? '全部加载完成' : null}
          </div>
        </>
      )}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">确认删除此任务？</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              此操作无法撤销。删除后，系统将停止所有关联的通知推送，并清理所有相关的调度参数。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="">
            <AlertDialogCancel className="rounded-xl h-11 px-6">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && deleteMutation.mutate(taskToDelete)}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-xl h-11 px-6 font-bold"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}