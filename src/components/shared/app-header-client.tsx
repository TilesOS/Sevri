"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { ProjectSidebarSlot } from "@/components/project/project-sidebar-slot";
import { Container } from "@/components/shared/container";
import { IconButton } from "@/components/ui/icon-button";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

const workspaceLinks: Array<{
  href: string;
  label: string;
  icon: NavIcon;
  match: (pathname: string) => boolean;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
  { href: "/recommendations", label: "Ideas", icon: Lightbulb, match: (p) => p.startsWith("/recommendations") },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: (p) => p.startsWith("/calendar") },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness, match: (p) => p.startsWith("/portfolio") },
];

interface AppShellClientProps {
  children: ReactNode;
  displayName: string;
  email?: string | null;
}

export function AppShellClient({ children, displayName, email }: AppShellClientProps) {
  const pathname = usePathname();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const initials = getInitials(displayName);

  useEffect(() => setIsMobileDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const drawer = mobileDrawerRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileDrawerOpen(false);
        mobileTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => drawer?.querySelector<HTMLElement>("a, button, summary")?.focus());
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isMobileDrawerOpen]);

  const closeMobileDrawer = () => setIsMobileDrawerOpen(false);

  return (
    <div className="product-ui relative min-h-screen bg-canvas">
      {isMobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[1px] lg:hidden"
          aria-label="Dismiss navigation"
          onClick={closeMobileDrawer}
        />
      ) : null}

      <aside className="app-sidebar-shell fixed inset-y-0 left-0 z-[65] hidden w-[var(--app-sidebar-width)] flex-col overflow-hidden lg:flex">
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={() => undefined}
        />
      </aside>

      <aside
        ref={mobileDrawerRef}
        aria-label="Main navigation"
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[60] flex w-[var(--app-sidebar-width)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden transition-transform duration-150 ease-out lg:hidden",
          isMobileDrawerOpen ? "translate-x-0" : "-translate-x-[105%]",
        )}
      >
        <div className="absolute right-3 top-3 z-10">
          <IconButton label="Close navigation" onClick={closeMobileDrawer}><X className="h-4 w-4" /></IconButton>
        </div>
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={closeMobileDrawer}
        />
      </aside>

      <div className="relative min-h-screen lg:ml-[var(--app-sidebar-width)]">
        <header className="sticky top-0 z-40 flex h-12 items-center border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-8">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface hover:text-ink lg:hidden"
            aria-label="Open navigation"
            aria-expanded={isMobileDrawerOpen}
            onClick={() => setIsMobileDrawerOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 text-sm font-medium text-ink-soft">{getPageLabel(pathname)}</div>
        </header>
        <main className="min-h-[calc(100vh-3rem)] py-6 sm:py-8">
          <Container>
            <PageTransition transitionKey={pathname}>{children}</PageTransition>
          </Container>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  displayName,
  email,
  initials,
  pathname,
  onNavigate,
}: {
  displayName: string;
  email?: string | null;
  initials: string;
  pathname: string;
  onNavigate: () => void;
}) {
  const isProjectRoute = pathname.startsWith("/project/");

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-3">
      <Link href="/dashboard" className="mb-5 flex h-9 items-center gap-2 rounded-lg px-2 text-ink" onClick={onNavigate}>
        <span className="grid h-6 w-6 place-items-center rounded-md bg-coral text-xs font-bold text-white">S</span>
        <span className="text-sm font-semibold tracking-tight">Sevri</span>
      </Link>

      <p className="mb-1 px-2 text-[11px] font-medium text-ink-muted">Workspace</p>
      <nav className="space-y-0.5" aria-label="Workspace">
        {workspaceLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn("tab", link.match(pathname) && "is-active")}
              onClick={onNavigate}
              aria-current={link.match(pathname) ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {isProjectRoute ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-line pt-4">
          <p className="mb-2 px-2 text-[11px] font-medium text-ink-muted">Current project</p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ProjectSidebarSlot pathname={pathname} />
          </div>
        </div>
      ) : <div className="flex-1" />}

      <details className="group relative mt-3 border-t border-line pt-3">
        <summary className="user-tab cursor-pointer list-none hover:bg-surface-strong marker:hidden">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
            {email ? <p className="truncate text-xs text-ink-muted">{email}</p> : null}
          </div>
          <ChevronDown className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="absolute bottom-12 left-0 right-0 rounded-xl border border-line bg-paper p-1 shadow-lifted">
          <Link href="/settings" className="tab" onClick={onNavigate}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>Settings</span>
          </Link>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="tab">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

function getInitials(displayName: string) {
  const parts = displayName.split(" ").map((part) => part.trim()).filter(Boolean).slice(0, 2);
  if (!parts.length) return "S";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/project/")) return "Project workspace";
  if (pathname.startsWith("/recommendations")) return "Ideas";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/portfolio")) return "Portfolio";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  return "Dashboard";
}
