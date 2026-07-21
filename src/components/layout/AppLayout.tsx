import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { cn } from "@/lib/utils";
type AppLayoutProps = {
  children: React.ReactNode;
  container?: boolean;
  className?: string;
  contentClassName?: string;
};
const SIDEBAR_STATE_KEY = "aura-notify-sidebar-state";
export function AppLayout({ children, container = false, className, contentClassName }: AppLayoutProps): JSX.Element {
  const location = useLocation();
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
      return saved === "true";
    } catch (e) {
      console.warn("Failed to read sidebar state from localStorage", e);
      return false;
    }
  });
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(isOpen));
    } catch (e) {
      console.warn("Failed to save sidebar state to localStorage", e);
    }
  };

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.body.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    } catch (e) {
      console.warn("Failed to scroll page to top", e);
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <AppSidebar open={open} />
      <SidebarInset className={cn("relative flex min-h-screen flex-col bg-background", className)}>
        <div className="absolute left-2 top-2 z-50">
          <SidebarTrigger className="h-9 w-9 rounded-xl border border-border/50 bg-background/80 backdrop-blur-sm shadow-sm hover:bg-accent" />
        </div>
        {container ? (
          <div className={cn(
            "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-12 lg:py-12",
            contentClassName
          )}>
            {children}
          </div>
        ) : (
          <div className={cn("flex-1", contentClassName)}>
            {children}
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}