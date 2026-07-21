import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BellRing, MessageCircle, Plus, ArrowRight, History, CheckCircle, XCircle, LayoutGrid, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { NotificationChannel, NotificationExecutionLog, NotificationTask } from '@shared/types';
import Logo from '../../public/logo.svg';

export function HomePage() {
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<NotificationTask[]>({
    queryKey: ['tasks'],
    queryFn: () => api<NotificationTask[]>('/api/tasks')
  });
  const { data: activeCountData } = useQuery<{ activeCount: number; totalCount: number }>({
    queryKey: ['tasks', 'active-count'],
    queryFn: () => api<{ activeCount: number; totalCount: number }>('/api/tasks/active-count')
  });
  const { data: channels = [], isLoading: isChannelsLoading } = useQuery<NotificationChannel[]>({
    queryKey: ['channels', { all: true, is_active: 1 }],
    queryFn: () => api<NotificationChannel[]>('/api/channels/all?is_active=1')
  });
  const { data: recentLogs = [], isLoading: isLogsLoading } = useQuery<NotificationExecutionLog[]>({
    queryKey: ['logs', { pageSize: 5 }],
    queryFn: () => api<NotificationExecutionLog[]>('/api/logs?page=1&pageSize=5')
  });
  const displayStats = [
    {
      label: '活跃通知任务',
      value: activeCountData?.activeCount ?? 0,
      total: activeCountData?.totalCount ?? 0,
      icon: BellRing,
      color: 'text-primary',
      bg: 'bg-primary/10',
      description: '个任务正在运行中'
    },
    {
      label: '已配置渠道',
      value: channels.filter((channel) => channel.is_active).length,
      total: channels.length,
      icon: MessageCircle,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
      description: '个推送平台已连接'
    },
  ];
  return (
    <AppLayout container>
      <section className="relative mb-12 py-12 md:py-16 overflow-hidden rounded-[2.5rem] bg-gradient-mesh border border-white/20 shadow-soft">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 px-8 text-center space-y-8"
        >
          <div className="flex justify-center">
            <motion.div
              initial={{ rotate: -15, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="p-2 bg-white/40 backdrop-blur-xl rounded-3xl shadow-glow border border-white/50"
            >
              <img src={Logo} className="w-12 h-12 animate-pulse" />
            </motion.div>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tightest text-foreground">
              Aura <span className="text-gradient">Notify</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground/80 font-medium max-w-2xl mx-auto leading-relaxed">
              简约、快速、可靠的个人自动化通知中心。<br className="hidden md:block" />
              通过多个渠道，在正确的时间接收您的重要提醒。
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Button asChild size="lg" className="btn-gradient px-8 py-7 text-lg rounded-2xl shadow-primary/25">
              <Link to="/tasks">
                <Plus className="mr-2 h-5 w-5" /> 开始创建任务
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="bg-white/40 backdrop-blur-md rounded-2xl px-8 py-7 text-lg border-white/50 hover:bg-white/60 transition-all">
              <Link to="/channels">
                <MessageCircle className="mr-2 h-5 w-5" /> 配置推送渠道
              </Link>
            </Button>
          </div>
        </motion.div>
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[500px] h-[500px] bg-primary/15 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[400px] h-[400px] bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {displayStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i + 0.5 }}
          >
            <Card className="hover:shadow-lg transition-all duration-300 border-border/50 overflow-hidden group rounded-3xl relative">
              <CardContent className="p-8 flex items-center justify-between">
                <div className="space-y-1 z-10">
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest opacity-60">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-5xl font-display font-black text-foreground">
                      {isTasksLoading || isChannelsLoading ? '...' : stat.value}
                    </p>
                    <span className="text-sm font-bold text-muted-foreground">/ {stat.total}</span>
                  </div>
                  <p className="text-xs font-bold text-muted-foreground/60 mt-2">{stat.description}</p>
                </div>
                <div className={`p-5 rounded-[2rem] ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-sm z-10`}>
                  <stat.icon className="w-10 h-10" />
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-500">
                  <stat.icon className="w-40 h-40" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/50 rounded-3xl shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-6 border-b border-border/40 bg-muted/20">
            <div>
              <CardTitle className="text-xl font-display font-bold flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" /> 最近活动
              </CardTitle>
              <CardDescription className="text-sm">查看最新触发的通知执行详细状态。</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary font-bold rounded-xl hover:bg-primary/5">
              <Link to="/history">
                查看全部流水 <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isLogsLoading ? (
              [1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted/30 animate-pulse rounded-2xl" />)
            ) : !recentLogs || recentLogs.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground bg-secondary/20 rounded-3xl border-2 border-dashed border-border/60">
                <History className="mx-auto h-10 w-10 opacity-10 mb-4" />
                <p className="text-sm font-bold">暂无推送记录</p>
                <p className="text-xs opacity-50 mt-1">创建并启用一个任务，系统将自动记录所有推送轨迹。</p>
              </div>
            ) : (
              recentLogs.map((log, idx) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx + 0.6 }}
                  className="flex items-center justify-between p-4 bg-secondary/30 border border-border/40 rounded-2xl hover:bg-white hover:shadow-soft hover:border-primary/20 transition-all group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 shadow-sm ${log.status === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {log.status === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-black truncate text-foreground group-hover:text-primary transition-colors">
                        {log.task_name || (log.task_id ? `任务: ${log.task_id}` : '未知任务')}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground/70 font-bold uppercase tracking-tight">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(log.executed_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                        <span className="opacity-30">•</span>
                        <span>{log.channel_name || (log.channel_id ? `渠道: ${log.channel_id}` : '未知渠道')}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={`text-[10px] py-0 px-2 font-black rounded-lg shadow-sm ${log.status === 'success' ? 'bg-success text-white' : 'bg-destructive text-white animate-pulse'}`}>
                    {log.status === 'success' ? '成功' : '失败'}
                  </Badge>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground rounded-3xl shadow-glow overflow-hidden relative">
             <CardContent className="p-8 space-y-4">
                <p className="text-xs font-black uppercase tracking-widest opacity-70">Aura Pro Tip</p>
                <p className="text-lg font-bold leading-snug">
                  您可以为同一个任务配置多个推送渠道，确保重要消息永不丢失。
                </p>
                <Link to="/tasks/new" className="inline-flex items-center gap-2 text-sm font-black group">
                  立即试用 <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <div className="absolute -right-6 -bottom-6 opacity-10">
                  <BellRing className="w-32 h-32 rotate-12" />
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
      <footer className="mt-12 pt-12 border-t border-border/40 text-center">
        <div className="flex justify-center gap-8 mb-4 opacity-30 grayscale grayscale-100 transition-all hover:grayscale-0">
          <span className="text-xs font-black uppercase tracking-tighter">React 18</span>
          <span className="text-xs font-black uppercase tracking-tighter">Cloudflare Workers</span>
          <span className="text-xs font-black uppercase tracking-tighter">Hono Engine</span>
        </div>
        <p className="text-muted-foreground/60 text-xs font-bold uppercase tracking-widest">&copy; {new Date().getFullYear()} Aura Notify Project. Crafted for focus.</p>
      </footer>
    </AppLayout>
  );
}