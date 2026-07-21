import React, { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Send, Info, ShieldCheck, Link as LinkIcon } from 'lucide-react';
import { NotificationChannel } from '@shared/types';
import { CHANNEL_TYPE_OPTIONS, CHANNEL_TYPES } from '@shared/constants';
import { motion } from 'framer-motion';

const parseChannelConfig = (config?: string) => {
  try {
    return JSON.parse(config || '{}');
  } catch {
    return {};
  }
};

const buildChannelPayload = (values: ChannelFormValues) => ({
  name: values.channel_name,
  type: values.channel_type,
  config: JSON.stringify(values.config ?? {}),
  is_active: values.is_active,
});

const channelSchema = z.object({
  channel_name: z.string().min(2, '渠道名称至少需要2个字符'),
  channel_type: z.enum(Object.values(CHANNEL_TYPES)),
  config: z.object({
    webhookUrl: z.string().url('必须是有效的 URL 地址').optional().or(z.literal('')),
    secret: z.string().optional(),
    botToken: z.string().optional(),
    chatId: z.string().optional(),
    apiKey: z.string().optional(),
    fromEmail: z.string().optional().or(z.literal('')),
    toEmail: z.string().email('必须是有效的邮箱地址').optional().or(z.literal('')),
    appid: z.string().optional(),
    userid: z.string().optional(),
    template_id: z.string().optional(),
    base_url: z.string().optional().or(z.literal('')),  // 服务端不需要前端录入，但保留字段
    appToken: z.string().optional(),
    uids: z.string().optional(),
    pushKey: z.string().optional(),
  }),
  is_active: z.number(),
});
type ChannelFormValues = z.infer<typeof channelSchema>;
export function ChannelFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { data: channel, isLoading } = useQuery({
    queryKey: ['channels', id],
    queryFn: () => api<NotificationChannel>(`/api/channels/${id}`),
    enabled: isEdit,
  });

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: {
      channel_name: '',
      channel_type: CHANNEL_TYPES.DINGTALK,
      config: {},
      is_active: 1,
    },
  });

  useEffect(() => {
    if (channel) {
      form.reset({
        channel_name: channel.name,
        channel_type: channel.type,
        config: parseChannelConfig(channel.config),
        is_active: channel.is_active,
      });
    }
  }, [channel, form]);

  const mutation = useMutation({
    mutationFn: (values: ChannelFormValues) => {
      const payload = buildChannelPayload(values);
      return isEdit
        ? api(`/api/channels/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : api('/api/channels', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(isEdit ? '渠道已更新' : '渠道已创建');
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      navigate(-1);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testConnectionMutation = useMutation({
    mutationFn: (values: ChannelFormValues) => {
      const payload = buildChannelPayload(values);
      return api('/api/channels/test', {
        method: 'POST',
        body: JSON.stringify({
          type: payload.type,
          config: payload.config,
        }),
      });
    },
    onSuccess: (res) => {
      console.log('Test connection response:', res);
      toast.success('测试消息发送成功，请检查您的通知渠道！');
    },
    onError: (err: Error) => {
      toast.error(err.message || '测试失败，请检查配置参数');
    },
  });

  const validateField = () => {
    const values = form.getValues();
    const type = values.channel_type;
    switch (type) {
      case CHANNEL_TYPES.DINGTALK:
      case CHANNEL_TYPES.FEISHU:
        if (!values.config.webhookUrl) {
          form.setError('config.webhookUrl', { type: 'manual', message: 'Webhook URL 是必填项' });
          return false;
        }
        break;
      case CHANNEL_TYPES.TELEGRAM:
        if (!values.config.botToken) {
          form.setError('config.botToken', { type: 'manual', message: 'Bot Token 是必填项' });
          return false;
        }
        if (!values.config.chatId) {
          form.setError('config.chatId', { type: 'manual', message: 'Chat ID 是必填项' });
          return false;
        }
        break;
      case CHANNEL_TYPES.RESEND:
        if (!values.config.apiKey) {
          form.setError('config.apiKey', { type: 'manual', message: 'API Key 是必填项' });
          return false;
        }
        if (!values.config.fromEmail) {
          form.setError('config.fromEmail', { type: 'manual', message: '发件人地址是必填项' });
          return false;
        }
        if (!values.config.toEmail) {
          form.setError('config.toEmail', { type: 'manual', message: '收件人地址是必填项' });
          return false;
        }
        break;
      case CHANNEL_TYPES.WXPUSH:
        if (!values.config.appid) {
          form.setError('config.appid', { type: 'manual', message: 'AppID 是必填项' });
          return false;
        }
        if (!values.config.secret) {
          form.setError('config.secret', { type: 'manual', message: 'Secret 是必填项' });
          return false;
        }
        if (!values.config.userid) {
          form.setError('config.userid', { type: 'manual', message: '用户 ID 是必填项' });
          return false;
        }
        if (!values.config.template_id) {
          form.setError('config.template_id', { type: 'manual', message: '模板 ID 是必填项' });
          return false;
        }
        break;
      case CHANNEL_TYPES.WXPUSHER:
        if (!values.config.appToken) {
          form.setError('config.appToken', { type: 'manual', message: 'AppToken 是必填项' });
          return false;
        }
        if (!values.config.uids) {
          form.setError('config.uids', { type: 'manual', message: '用户 ID(UIDs) 是必填项' });
          return false;
        }
        break;
      case CHANNEL_TYPES.PUSHME:
        if (!values.config.pushKey) {
          form.setError('config.pushKey', { type: 'manual', message: 'PushKey 是必填项' });
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  }

  const selectedType = form.watch('channel_type');

  const onSubmit = useCallback((values: ChannelFormValues) => {
    if (!validateField()) {
      return;
    }
    // 增加必填字段验证
    mutation.mutate(values);
  }, [mutation, selectedType]);

  // 根据选择的渠道类型，动态生成文档链接
  const docLink = useMemo(() => {
    const item = CHANNEL_TYPE_OPTIONS.find((item) => item.value === selectedType);
    return item?.docLink || '';
  }, [selectedType]);

  if (isEdit && isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <AppLayout container>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              {isEdit ? '编辑渠道' : '添加推送渠道'}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {isEdit ? '更新该渠道的连接参数与鉴权凭据。' : '连接一个新的第三方平台用于接收自动化通知。'}
            </p>
          </div>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="border-border/50 shadow-soft overflow-hidden rounded-3xl">
              <CardHeader className="bg-muted/20 border-b border-border/50 py-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" /> 基础属性
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <FormField control={form.control} name="channel_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">渠道备注名称</FormLabel>
                    <FormControl><Input placeholder="例如：运维报警 - 钉钉机器人" className="bg-secondary/30 border-border/50 focus:bg-background h-12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="channel_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">平台类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                      <FormControl><SelectTrigger className="bg-secondary/30 border-border/50 h-12"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CHANNEL_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-soft overflow-hidden rounded-3xl">
              <CardHeader className="bg-muted/20 border-b border-border/50 py-5 px-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> 鉴权与端点配置
                  <a
                    href={docLink || "https://github.com/chengzhnag/aura-notify-workers"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 flex items-center gap-1 uppercase tracking-widest"
                  >
                    <span className="text-[10px] text-primary">查看文档</span>
                    <LinkIcon className="h-2 w-2 text-primary" />
                  </a>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                {(selectedType === CHANNEL_TYPES.DINGTALK || selectedType === CHANNEL_TYPES.FEISHU) && (
                  <div className="grid grid-cols-1 gap-6">
                    <FormField control={form.control} name="config.webhookUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Webhook 接口地址</FormLabel>
                        <FormControl><Input placeholder="https://..." className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="config.secret" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">签名密钥 (Secret)</FormLabel>
                        <FormControl><Input type="password" placeholder="填写加签模式对应的 Secret，若无则留空" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
                {selectedType === CHANNEL_TYPES.TELEGRAM && (
                  <div className="grid grid-cols-1 gap-6">
                    <FormField control={form.control} name="config.botToken" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Bot API Token</FormLabel>
                        <FormControl><Input type="password" placeholder="123456789:ABCDefgh..." className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="config.chatId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Chat ID</FormLabel>
                        <FormControl><Input placeholder="例如：-100123456789" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
                {selectedType === CHANNEL_TYPES.RESEND && (
                  <div className="grid grid-cols-1 gap-6">
                    <FormField control={form.control} name="config.apiKey" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Resend API Key</FormLabel>
                        <FormControl><Input type="password" placeholder="re_123456..." className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={form.control} name="config.fromEmail" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">发件人地址</FormLabel>
                          <FormControl><Input placeholder="notify@yourdomain.com" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="config.toEmail" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">收件人地址</FormLabel>
                          <FormControl><Input placeholder="user@example.com" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}
                {selectedType === CHANNEL_TYPES.WXPUSH && (
                  <div className="grid grid-cols-1 gap-6">
                    <FormField control={form.control} name="config.appid" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">AppID</FormLabel>
                        <FormControl><Input placeholder="微信测试号 AppID" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="config.secret" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Secret</FormLabel>
                        <FormControl><Input type="password" placeholder="微信测试号 Secret" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="config.userid" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">用户 ID</FormLabel>
                        <FormControl><Input placeholder="接收消息的用户ID，多个逗号隔开" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="config.template_id" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">模板 ID</FormLabel>
                        <FormControl><Input placeholder="模板消息 ID" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
                {selectedType === CHANNEL_TYPES.WXPUSHER && (
                  <div className="grid grid-cols-1 gap-6">
                    <FormField control={form.control} name="config.appToken" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">AppToken</FormLabel>
                        <FormControl><Input placeholder="WxPusher 的 AppToken" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="config.uids" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">用户 IDs (UIDs)</FormLabel>
                        <FormControl><Input placeholder="多个 UID 用逗号隔开，例如：UID_123,UID_456" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
                {selectedType === CHANNEL_TYPES.PUSHME && (
                  <div className="grid grid-cols-1 gap-6">
                    <FormField control={form.control} name="config.pushKey" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">PushKey</FormLabel>
                        <FormControl><Input placeholder="PushMe 的 PushKey" className="bg-secondary/30 border-border/50 focus:bg-background" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" className="w-full sm:flex-1 btn-gradient py-7 rounded-2xl text-lg font-bold shadow-primary/20 order-1 sm:order-none" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isEdit ? '保存更改' : '建立并激活渠道'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1 h-14 rounded-2xl border-border/50 bg-background font-bold hover:bg-accent transition-all order-2 sm:order-none"
                onClick={() => {
                  if (!validateField()) {
                    return;
                  }
                  const values = form.getValues();
                  testConnectionMutation.mutate(values);
                }}
                disabled={testConnectionMutation.isPending}
              >
                {testConnectionMutation.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                <Send className="mr-2 h-5 w-5" />
                测试连接状态
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </AppLayout>
  );
}