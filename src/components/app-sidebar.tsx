import React from "react";
import { Home, BellRing, Network, Settings, History, Info, Plus, LogOut, Moon, Sun } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarSeparator,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Logo from '../../public/logo.svg';

export function AppSidebar({ open }: { open: boolean }): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthLogout();
  const { isDark, toggleTheme } = useTheme();
  const menuItems = [
    { title: "仪表盘", icon: Home, path: "/" },
    { title: "通知任务", icon: BellRing, path: "/tasks" },
    { title: "通知渠道", icon: Network, path: "/channels" },
  ];
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50 bg-background/95 backdrop-blur-sm">
      <SidebarHeader className="h-16 flex items-center justify-center px-4 border-b border-border/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-8 w-8 min-w-[2rem] rounded-lg flex items-center justify-center shrink-0">
            <img src={Logo} className="w-full h-full" />
          </div>
          <span className="text-lg font-display font-bold tracking-tight group-data-[collapsible=icon]:hidden whitespace-nowrap">
            Aura <span className="text-primary">Notify</span>
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            主要功能
          </SidebarGroupLabel>
          <SidebarMenu className="px-2 group-data-[collapsible=icon]:items-center">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === item.path}
                  tooltip={item.title}
                  className="rounded-lg transition-all duration-200 hover:bg-accent group"
                >
                  <Link to={item.path} className="flex items-center gap-3 py-2 px-3">
                    <item.icon className={`h-5 w-5 transition-colors ${location.pathname === item.path ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="mx-4 opacity-50" />
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            系统管理
          </SidebarGroupLabel>
          <SidebarMenu className="px-2 group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/history'}
                tooltip="执行历史"
                className="rounded-lg transition-all duration-200 hover:bg-accent"
              >
                <Link to="/history" className="flex items-center gap-3 py-2 px-3">
                  <History className={`h-5 w-5 transition-colors ${location.pathname === '/history' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium group-data-[collapsible=icon]:hidden">执行历史</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* 关于系统 */}
            <SidebarMenuItem>
              <Dialog>
                <DialogTrigger asChild>
                  <SidebarMenuButton
                    asChild
                    tooltip="关于系统"
                    className="rounded-lg transition-all duration-200 hover:bg-accent cursor-pointer"
                  >
                    <div className="flex items-center gap-3 py-2 px-3">
                      <Info className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium group-data-[collapsible=icon]:hidden">关于系统</span>
                    </div>
                  </SidebarMenuButton>
                </DialogTrigger>
                <DialogContent className="rounded-3xl border-border/50 max-w-md w-[calc(100vw-2rem)] sm:w-auto">
                  <DialogHeader className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-primary/30 shadow-lg">
                        <img src={Logo} className="w-full h-full" />
                      </div>
                    </div>
                    <DialogTitle className="text-2xl font-display font-black text-center">
                      Aura <span className="text-primary">Notify</span>
                    </DialogTitle>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full mx-auto">
                      v1.0.0
                    </Badge>
                  </DialogHeader>
                  <DialogDescription className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      基于 Cloudflare Worker Scheduler 的个人通知助手，支持配置钉钉、飞书、Telegram、邮件等多种通知渠道。
                      <br />
                      只需简单配置，即可定时提醒自己完成各种事务，例如每天早上九点锻炼身体、每天晚上十点复盘工作进度、每周五整理下周计划等，养成良好的自我管理习惯。
                    </p>
                    <Button variant="outline" className="rounded-xl gap-2" asChild>
                      <a href="https://github.com/chengzhnag/aura-notify" target="_blank" rel="noopener noreferrer">
                        <FaGithub className="h-4 w-4" />
                        GitHub
                      </a>
                    </Button>
                  </DialogDescription>
                </DialogContent>
              </Dialog>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <div className="px-6 py-3 border-t border-border/50 flex items-center gap-2 group-data-[collapsible=icon]:px-1">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          {isDark ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          <span className="text-sm font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">{isDark ? "暗色模式" : "亮色模式"}</span>
        </div>
        <Button variant="outline" size="sm" onClick={toggleTheme} className="rounded-lg gap-2">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="group-data-[collapsible=icon]:hidden">{isDark ? "切换亮色" : "切换暗色"}</span>
        </Button>
      </div>
      <SidebarFooter className="p-4 border-t border-border/50 group-data-[collapsible=icon]:items-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <SidebarMenuButton tooltip="退出登录" className="rounded-lg transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group/1">
              <div className="flex items-center gap-3">
                <LogOut className="h-5 w-5 text-muted-foreground group-hover/1:text-destructive" />
                <span className="font-medium group-data-[collapsible=icon]:hidden">退出登录</span>
              </div>
            </SidebarMenuButton>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl border-border/50">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">确定要退出登录吗？</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                退出后，您需要重新输入凭据才能访问系统配置和任务管理。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="">
              <AlertDialogCancel className="rounded-xl h-11 px-6">取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className="bg-destructive text-white hover:bg-destructive/90 rounded-xl h-11 px-6 font-bold"
              >
                确定退出
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarFooter>
    </Sidebar>
  );
}