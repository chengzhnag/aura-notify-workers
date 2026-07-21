import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShieldAlert, Info, Database, Palette, Loader2, Activity, Key, Cpu } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";
import { NotificationChannel, NotificationTask } from '@shared/types';
export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useQuery<NotificationTask[]>({
    queryKey: ['tasks'],
    queryFn: () => api<NotificationTask[]>('/api/tasks')
  });
  const { data: channels = [] } = useQuery<NotificationChannel[]>({
    queryKey: ['channels'],
    queryFn: () => api<NotificationChannel[]>('/api/channels')
  });
  const clearHistoryMutation = useMutation({
    mutationFn: () => api('/api/logs?before=2099-12-31%2023:59:59', { method: 'DELETE' }),
    onSuccess: (res: any) => {
      toast.success(res.message || '历史数据已清空');
      queryClient.invalidateQueries({ queryKey: ['global-history'] });
      queryClient.invalidateQueries({ queryKey: ['system-stats'] });
    },
    onError: (err: Error) => toast.error(`操作失败: ${err.message}`),
  });
  return (
    <AppLayout container>
      <ThemeToggle />
      <PageHeader
        title="系统全局配置"
        description="管理 Aura Notify 的运行状态、数据存储策略以及视觉交互偏好。"
      />
      <Tabs defaultValue="data" className="space-y-10">
        <div className="flex justify-start">
          <TabsList className="bg-secondary/50 p-1.5 rounded-2xl border border-border/50 h-auto">
            <TabsTrigger value="data" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2 font-bold">
              <Database className="h-4 w-4" /> 数据管理
            </TabsTrigger>
            <TabsTrigger value="appearance" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2 font-bold">
              <Palette className="h-4 w-4" /> 界面偏好
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all gap-2 font-bold">
              <Info className="h-4 w-4" /> 关于系统
            </TabsTrigger>
          </TabsList>
        </div>
        <AnimatePresence mode="wait">
          <TabsContent value="data" className="focus-visible:outline-none focus-visible:ring-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: '系统健康度', value: 'Excellent', icon: Activity, detail: 'Cloudflare Edge', color: 'text-success' },
                  { label: '持久化任务', value: `${tasks.length} Unit`, icon: Database, detail: 'Durable Objects', color: 'text-primary' },
                  { label: '运行内核', value: 'Hono v4', icon: Cpu, detail: 'Runtime v2025', color: 'text-indigo-500' },
                  { label: '会话状态', value: 'Encrypted', icon: Key, detail: 'Session Layer', color: 'text-amber-500' }
                ].map((stat, i) => (
                  <Card key={i} className="border-border/50 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <stat.icon className="h-3 w-3" /> {stat.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-display font-black truncate">{stat.value}</p>
                      <p className={cn("text-[10px] font-bold mt-1 uppercase tracking-tight", stat.color)}>{stat.detail}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="border-destructive/20 shadow-soft overflow-hidden bg-destructive/5 rounded-3xl">
                <CardHeader className="border-b border-destructive/10 py-5 px-6 bg-destructive/5">
                  <CardTitle className="text-base text-destructive font-black flex items-center gap-2 uppercase tracking-tight">
                    <ShieldAlert className="h-4 w-4" /> 危险管理区域
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 bg-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-[2rem] border border-border/50 bg-secondary/10">
                    <div className="space-y-1">
                      <p className="font-black text-foreground">清空历史分发数据</p>
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-md font-medium">
                        该操作将永久抹除所有通知执行流水记录。清空后无法通过任何手段恢复，请谨慎操作。
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="lg" className="rounded-2xl px-10 font-black shadow-lg shadow-destructive/10">
                          立即销毁数据
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-border/50">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl">确认执行数据清除任务？</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            一旦确认，系统将立刻释放所有的历史日志存储空间。该行为会被系统内核记录。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="">
                          <AlertDialogCancel className="rounded-xl h-11 px-6">保留数据</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => clearHistoryMutation.mutate()}
                            className="bg-destructive text-white hover:bg-destructive/90 rounded-xl h-11 px-6 font-bold"
                          >
                            执行销毁
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          <TabsContent value="appearance" className="focus-visible:outline-none focus-visible:ring-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <Card className="border-border/50 rounded-3xl shadow-soft overflow-hidden">
                <CardHeader className="py-6 px-8 border-b border-border/50">
                  <CardTitle className="text-xl font-display font-black">视觉偏好设置</CardTitle>
                  <CardDescription>控制 Aura Notify 的界面表现形式，包括配色模式与交互深度。</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-[2rem] bg-secondary/20 border border-border/50 group">
                    <div className="space-y-1 text-center sm:text-left">
                      <p className="font-black text-lg">暗色模式 (Dark Mode)</p>
                      <p className="text-xs text-muted-foreground font-medium">切换至暗色界面以减少低光环境下的视觉疲劳。</p>
                    </div>
                    <div className="bg-background p-1.5 rounded-2xl border border-border/50 shadow-sm transition-transform group-hover:scale-105">
                      <ThemeToggle className="static" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
          <TabsContent value="about" className="focus-visible:outline-none focus-visible:ring-0">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              <Card className="border-border/50 rounded-[3rem] shadow-glow overflow-hidden bg-card">
                <CardContent className="flex flex-col items-center py-20 px-8 space-y-10">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-[2rem] bg-primary flex items-center justify-center text-primary-foreground text-4xl font-black shadow-primary/30 shadow-2xl transition-transform duration-500 group-hover:rotate-12">
                      A
                    </div>
                    <div className="absolute -top-4 -right-4 h-10 w-10 bg-success text-white rounded-full flex items-center justify-center shadow-lg animate-bounce border-4 border-card">
                      <Cpu className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="text-center space-y-4">
                    <h2 className="text-4xl font-display font-black tracking-tightest">Aura <span className="text-primary">Notify</span></h2>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-full">
                      v0.1.0-alpha Release
                    </Badge>
                  </div>
                  <div className="text-center text-sm text-muted-foreground max-w-lg leading-relaxed font-medium antialiased">
                    <p>
                      一款针对个人开发者与效率专家打造的极简通知路由中心。
                      基于 Cloudflare 全球边缘网络，我们致力于提供零延迟、高可靠且隐私优先的消息分发体验。
                    </p>
                  </div>
                  <div className="pt-10 border-t border-border/50 w-full max-w-xs text-center space-y-4">
                    <p className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">
                      Crafted for the future of focus.
                    </p>
                    <div className="flex justify-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
                      <div className="text-[10px] font-black">CF DO</div>
                      <div className="text-[10px] font-black">HONO</div>
                      <div className="text-[10px] font-black">REACT 18</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
      <footer className="mt-24 py-12 border-t border-border/40 text-center">
        <p className="text-[10px] text-muted-foreground/30 font-black uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} Aura Project Node. Persistent Edge Storage Activated.
        </p>
      </footer>
    </AppLayout>
  );
}