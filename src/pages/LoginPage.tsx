import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthLogin, useIsAuthenticated } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import { Loader2, Lock, User, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});
type LoginFormValues = z.infer<typeof loginSchema>;
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthLogin();
  const isAuthenticated = useIsAuthenticated();
  const [isSubmitting, setIsSubmitting] = useState(false);
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: 'Aura', password: '' },
  });
  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const success = await login(values.password);
      if (success) {
        toast.success('欢迎回来，认证成功');
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        toast.error('用户名或密码错误，请重试');
      }
    } catch {
      toast.error('登录请求失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen w-full flex flex-col bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh opacity-10 pointer-events-none" />
      <ThemeToggle className="absolute top-6 right-6" />
      <main className="flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md z-10"
        >
          <Card className="border-border/50 shadow-soft bg-card/90 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
            <CardHeader className="pt-12 pb-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black shadow-primary/20 shadow-lg">
                  A
                </div>
              </div>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-display font-black tracking-tight">
                  Aura <span className="text-primary">Notify</span>
                </CardTitle>
                <CardDescription className="text-sm font-medium text-muted-foreground/70">
                  请登录以访问您的个人通知中心
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-12">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">用户名</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                              placeholder="请输入用户名"
                              disabled
                              className="pl-11 h-12 rounded-xl bg-secondary/50 border-input hover:border-primary/30 focus:bg-background transition-all"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">密码</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                              type="password"
                              placeholder="请输入密码"
                              className="pl-11 h-12 rounded-xl bg-secondary/50 border-input hover:border-primary/30 focus:bg-background transition-all"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-bold shadow-md shadow-primary/10 mt-4 transition-all"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    立即登录
                  </Button>
                </form>
              </Form>
              <div className="mt-8 pt-6 border-t border-border/40 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                  Aura Security Node v1.0.4
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
      <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 w-[600px] h-[600px] bg-primary/5 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
}