import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, BellRing, Info, X } from 'lucide-react';
import { NotificationTask, NotificationChannel } from '@shared/types';
import { DATE_TYPE_OPTIONS, DATE_TYPES, TASK_TYPE_OPTIONS, TASK_TYPES, TASK_STATUS } from '@shared/constants';
import { motion } from 'framer-motion';

// 生成00:00到23:30每隔半小时的时间选项
const TIMES = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

const parseTaskFrequency = (frequency?: string) => {
  try {
    const values = JSON.parse(frequency || '[]');
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
};

const parseChannelIds = (value?: string) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
};

const buildTaskPayload = (values: TaskFormValues) => {
  const payload: Record<string, unknown> = {
    name: values.task_name,
    description: values.task_description || '',
    title: values.task_title,
    content: values.task_content,
    task_type: values.task_type,
    frequency: JSON.stringify(values.frequency || []),
    channel_ids: JSON.stringify(values.channel_ids || []),
    date_types: values.date_types,
    status: values.is_active ? TASK_STATUS.ACTIVE : TASK_STATUS.INACTIVE,
  };

  if (values.task_type === TASK_TYPES.SINGLE) {
    payload.execute_date = values.execute_date || null;
  } else if (values.task_type === TASK_TYPES.RECURRING) {
    payload.start_date = values.start_date || null;
    payload.end_date = values.end_date || null;
  }

  return payload;
};

const taskSchema = z.object({
  task_name: z.string().min(2, '任务名称至少需要2个字符'),
  task_description: z.string().optional().or(z.literal('')),
  task_title: z.string().min(1, '通知标题是必填项'),
  task_content: z.string().min(1, '通知内容是必填项'),
  task_type: z.enum([TASK_TYPES.SINGLE, TASK_TYPES.RECURRING, TASK_TYPES.PERMANENT]),
  date_types: z.enum([DATE_TYPES.WORKDAY, DATE_TYPES.HOLIDAY, DATE_TYPES.ALL]),
  frequency: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '时间格式错误 (HH:mm)')).min(1, '请至少添加一个执行时间'),
  execute_date: z.string().optional().or(z.literal('')),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  channel_ids: z.array(z.string()).min(1, '请至少选择一个推送渠道'),
  is_active: z.boolean(),
}).superRefine((data, ctx) => {
  if (data.task_type === TASK_TYPES.SINGLE && !data.execute_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "单次执行任务必须选择执行日期",
      path: ["execute_date"],
    });
  }
  if (data.task_type === TASK_TYPES.RECURRING) {
    if (!data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "周期任务必须选择开始日期",
        path: ["start_date"],
      });
    }
    if (!data.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "周期任务必须选择结束日期",
        path: ["end_date"],
      });
    }
  }
});
type TaskFormValues = z.infer<typeof taskSchema>;
export function TaskFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { data: channels = [] } = useQuery<NotificationChannel[]>({
    queryKey: ['channels', { all: true, is_active: 1 }],
    queryFn: () => api<NotificationChannel[]>('/api/channels/all?is_active=1'),
  });
  const { data: task, isLoading: isTaskLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api<NotificationTask>(`/api/tasks/${id}`),
    enabled: isEdit,
  });
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      task_name: '',
      task_description: '',
      task_title: '',
      task_content: '',
      task_type: TASK_TYPES.SINGLE,
      date_types: DATE_TYPES.ALL,
      frequency: [],
      execute_date: '',
      start_date: '',
      end_date: '',
      channel_ids: [],
      is_active: true,
    },
  });
  useEffect(() => {
    if (task) {
      const today = new Date().toISOString().slice(0, 10);
      const nextYear = new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10);

      form.reset({
        task_name: task.name || '',
        task_description: task.description || '',
        task_title: task.title || '',
        task_content: task.content || '',
        task_type: task.task_type || TASK_TYPES.SINGLE,
        date_types: task.date_types || DATE_TYPES.ALL,
        frequency: parseTaskFrequency(task.frequency),
        execute_date: task.execute_date || '',
        start_date: task.start_date || today,
        end_date: task.end_date || nextYear,
        channel_ids: parseChannelIds(task.channel_ids),
        is_active: task.status === TASK_STATUS.ACTIVE,
      });
    }
  }, [task, form]);
  const mutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      const payload = buildTaskPayload(values);
      return isEdit
        ? api(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(isEdit ? '任务已更新' : '任务已创建');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate(-1);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const onSubmit = (values: TaskFormValues) => mutation.mutate(values);
  if (isEdit && isTaskLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }
  const selectedType = form.watch('task_type');
  return (
    <AppLayout container>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              {isEdit ? '编辑通知任务' : '创建新任务'}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isEdit ? '修改现有任务的配置。' : '定义一个新的自动化通知任务，并设置其调度规则。'}
            </p>
          </div>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="pb-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-8 space-y-8">
              <Card className="border-border/50 shadow-soft overflow-hidden rounded-3xl">
                <CardHeader className="bg-muted/20 border-b border-border/50 py-5 px-6">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" /> 任务概况
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <FormField control={form.control} name="task_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">任务名称</FormLabel>
                      <FormControl><Input placeholder="例如：每日站会提醒" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="task_description" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">描述 (可选)</FormLabel>
                      <FormControl><Textarea placeholder="说明该任务的主要用途..." className="bg-secondary/30 border-border/50 focus:bg-background min-h-[100px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-soft overflow-hidden rounded-3xl">
                <CardHeader className="bg-muted/20 border-b border-border/50 py-5 px-6">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-primary" /> 通知负载 (Payload)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6">
                  <FormField control={form.control} name="task_title" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">通知标题</FormLabel>
                      <FormControl><Input placeholder="显示在通知顶部的关键标题" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="task_content" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">消息正文</FormLabel>
                      <FormControl><Textarea rows={6} placeholder="具体的消息内容(支持MarkDown写法)..." className="bg-secondary/30 border-border/50 focus:bg-background font-sans leading-relaxed" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-border/50 shadow-soft rounded-3xl">
                <CardHeader className="py-5 px-6">
                  <CardTitle className="text-base font-bold">执行策略</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-6 pt-0">
                  <FormField control={form.control} name="task_type" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">任务类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="bg-secondary/30 border-border/50"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {TASK_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="frequency" render={({ field }) => {
                    const frequencies = form.watch('frequency');

                    return (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">执行时间 (可多选)</FormLabel>
                        <div className="space-y-2">
                          <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-2 bg-secondary/20 rounded-xl border border-border/50">
                            {TIMES.map((time) => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  const updated = frequencies.includes(time)
                                    ? frequencies.filter(t => t !== time)
                                    : [...frequencies, time].sort();
                                  form.setValue('frequency', updated.length > 0 ? updated : []);
                                  form.trigger('frequency'); // 手动触发验证
                                }}
                                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${frequencies.includes(time)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-background border border-border/50 hover:border-primary/50'
                                  }`}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                          <div className="text-[10px] text-muted-foreground">已选择: {frequencies.sort().join(', ') || '-'}</div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }} />

                  {selectedType === 'single' && (
                    <FormField control={form.control} name="execute_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">执行日期 (YYYY-MM-DD)</FormLabel>
                        <FormControl><Input type="date" className="bg-secondary/30 border-border/50" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}

                  {selectedType === 'recurring' && (
                    <div className="space-y-4">
                      <FormField control={form.control} name="start_date" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">开始日期 (YYYY-MM-DD)</FormLabel>
                          <FormControl><Input type="date" className="bg-secondary/30 border-border/50" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="end_date" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">结束日期 (YYYY-MM-DD)</FormLabel>
                          <FormControl><Input type="date" className="bg-secondary/30 border-border/50" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}

                  <FormField control={form.control} name="date_types" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">日期模式过滤</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="bg-secondary/30 border-border/50"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {DATE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-[10px] text-muted-foreground leading-tight mt-2 italic">
                        选择特定模式后，即使满足调度时刻，非匹配日期也不会触发。
                      </FormDescription>
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-soft rounded-3xl">
                <CardHeader className="py-5 px-6">
                  <CardTitle className="text-base font-bold">
                    目标渠道
                    <Button onClick={(e) => {
                      e.preventDefault();
                      form.setValue("channel_ids", channels.map((c) => String(c.id)));
                      form.trigger("channel_ids"); // 手动触发验证
                    }} variant="link" className="ml-4 p-0 text-primary hover:text-primary/80 no-underline">
                      全选
                    </Button>
                    <Button onClick={(e) => {
                      e.preventDefault();
                      form.setValue("channel_ids", []);
                      form.trigger("channel_ids"); // 手动触发验证
                    }} variant="link" className="ml-4 p-0 text-primary hover:text-primary/80 no-underline">
                      清空
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-6 pt-0">
                  {channels?.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-border/50 rounded-2xl bg-secondary/10">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        暂无可用渠道
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 px-4">
                        请先创建并启用至少一个推送渠道，才能将任务发送到目标渠道。
                      </p>
                    </div>
                  ) : (
                    <FormField control={form.control} name="channel_ids" render={({ field }) => (
                      <FormItem className='flex flex-wrap gap-2 space-y-0'>
                        {
                          channels?.map((channel) => (
                            <FormItem key={channel.id} className="flex items-center space-x-3 space-y-0 p-2 rounded-2xl border border-transparent hover:border-border hover:bg-secondary/30 transition-all cursor-pointer">
                              <FormControl>
                                <Checkbox
                                  id={`ch-${channel.id}`}
                                  checked={field.value.includes(String(channel.id))}
                                  onCheckedChange={(checked) => {
                                    return checked ? field.onChange([...field.value, String(channel.id)]) : field.onChange(field.value.filter((v) => v !== String(channel.id)));
                                  }}
                                />
                              </FormControl>
                              <label htmlFor={`ch-${channel.id}`} className="font-bold text-sm cursor-pointer flex-1 truncate">
                                {channel.name}
                              </label>
                            </FormItem>
                          ))
                        }
                        <div className="w-full">
                          <FormMessage />
                        </div>
                      </FormItem>
                    )} />
                  )}
                </CardContent>
              </Card>
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full btn-gradient py-7 rounded-2xl text-lg font-bold shadow-primary/20" disabled={mutation.isPending || channels?.length === 0}>
                  {mutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {isEdit ? '保存任务配置' : '创建并启用任务'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={mutation.isPending} className="w-full h-14 rounded-2xl font-bold opacity-60 hover:opacity-100 transition-opacity">
                  取消操作
                </Button>
              </div>
            </div>
          </motion.div>
        </form>
      </Form>
    </AppLayout>
  );
}