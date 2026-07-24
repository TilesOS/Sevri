"use client";

import type { ComponentType, CSSProperties, ReactNode, SVGProps } from "react";
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
  PanelLeft,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { ProjectSidebarSlot } from "@/components/project/project-sidebar-slot";
import { Container } from "@/components/shared/container";
import { IconButton } from "@/components/ui/icon-button";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

const DEFAULT_SIDEBAR_WIDTH = 248;
const MIN_SIDEBAR_WIDTH = 208;
const MAX_SIDEBAR_WIDTH = 360;
const SIDEBAR_COLLAPSE_THRESHOLD = 176;
const SIDEBAR_STORAGE_KEY = "sevri:sidebar";

const workspaceLinks: Array<{
  href: string;
  label: string;
  icon: NavIcon;
  match: (pathname: string) => boolean;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
  { href: "/recommendations", label: "Project ideas", icon: Lightbulb, match: (p) => p.startsWith("/recommendations") },
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
  const lastExpandedSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] = useState(false);
  const initials = getInitials(displayName);

  useEffect(() => setIsMobileDrawerOpen(false), [pathname]);
  const headerBreadcrumbs = getHeaderBreadcrumbs(pathname);

  useEffect(() => {
    try {
      const savedPreference = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (savedPreference) {
        const parsed = JSON.parse(savedPreference) as { width?: number; collapsed?: boolean };
        if (typeof parsed.width === "number") {
          const savedWidth = clampSidebarWidth(parsed.width);
          setSidebarWidth(savedWidth);
          lastExpandedSidebarWidthRef.current = savedWidth;
        }
        if (typeof parsed.collapsed === "boolean") {
          setIsSidebarCollapsed(parsed.collapsed);
        }
      }
    } catch {
      // Ignore invalid or unavailable local storage and use the default layout.
    } finally {
      setHasLoadedSidebarPreference(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarPreference || isSidebarResizing) return;
    try {
      window.localStorage.setItem(
        SIDEBAR_STORAGE_KEY,
        JSON.stringify({ width: sidebarWidth, collapsed: isSidebarCollapsed }),
      );
    } catch {
      // The sidebar still works when storage is unavailable; it simply will not persist.
    }
  }, [hasLoadedSidebarPreference, isSidebarCollapsed, isSidebarResizing, sidebarWidth]);

  useEffect(() => {
    if (!isSidebarResizing) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.clientX <= SIDEBAR_COLLAPSE_THRESHOLD) {
        setIsSidebarCollapsed(true);
        return;
      }

      const nextWidth = clampSidebarWidth(event.clientX);
      setIsSidebarCollapsed(false);
      setSidebarWidth(nextWidth);
      lastExpandedSidebarWidthRef.current = nextWidth;
    };
    const stopResizing = () => setIsSidebarResizing(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopResizing, { once: true });
    window.addEventListener("pointercancel", stopResizing, { once: true });

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isSidebarResizing]);

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
  const desktopSidebarWidth = isSidebarCollapsed ? 0 : sidebarWidth;
  const shellStyle = {
    "--desktop-sidebar-width": `${desktopSidebarWidth}px`,
  } as CSSProperties;

  const restoreSidebar = () => {
    const restoredWidth = clampSidebarWidth(lastExpandedSidebarWidthRef.current);
    setSidebarWidth(restoredWidth);
    setIsSidebarCollapsed(false);
  };

  return (
    <div className="product-ui relative min-h-screen bg-canvas" style={shellStyle}>
      {isMobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[1px] lg:hidden"
          aria-label="Dismiss navigation"
          onClick={closeMobileDrawer}
        />
      ) : null}

      <aside
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[65] hidden w-[var(--desktop-sidebar-width)] flex-col lg:flex",
          !isSidebarResizing && "transition-[width] duration-200 ease-out",
        )}
      >
        <div className="h-full overflow-hidden">
          <div className="h-full" style={{ minWidth: sidebarWidth }}>
            <SidebarContent
              displayName={displayName}
              email={email}
              initials={initials}
              pathname={pathname}
              onNavigate={() => undefined}
            />
          </div>
        </div>
        {!isSidebarCollapsed ? (
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            className="group absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none outline-none"
            onPointerDown={(event) => {
              event.preventDefault();
              setIsSidebarResizing(true);
            }}
            onDoubleClick={() => setIsSidebarCollapsed(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setIsSidebarCollapsed(true);
                return;
              }
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const direction = event.key === "ArrowLeft" ? -16 : 16;
              const nextWidth = clampSidebarWidth(sidebarWidth + direction);
              setSidebarWidth(nextWidth);
              lastExpandedSidebarWidthRef.current = nextWidth;
            }}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
                isSidebarResizing && "opacity-100",
              )}
              aria-hidden="true"
            />
          </div>
        ) : null}
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

      <div
        className={cn(
          "relative min-h-screen lg:ml-[var(--desktop-sidebar-width)]",
          !isSidebarResizing && "transition-[margin-left] duration-200 ease-out",
        )}
      >
        <header className="sticky top-0 z-40 flex h-14 items-center border-b border-line/80 bg-paper/85 px-4 backdrop-blur-xl sm:px-8">
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
          {isSidebarCollapsed ? (
            <IconButton
              label="Open sidebar"
              className="mr-2 hidden border-line bg-paper shadow-[0_1px_2px_rgba(24,35,58,0.06)] lg:inline-flex"
              onClick={restoreSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </IconButton>
          ) : null}
          <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {headerBreadcrumbs.map((item, index) => (
              <div
                key={`${item.href}-${item.label}`}
                className={cn("min-w-0 items-center gap-2", index === 0 ? "flex" : "hidden sm:flex")}
              >
                {index > 0 ? <span className="text-ink-muted">/</span> : null}
                <Link
                  href={item.href}
                  className={cn(
                    "truncate transition-colors hover:text-ink",
                    index === headerBreadcrumbs.length - 1
                      ? "font-medium text-ink"
                      : "text-ink-muted",
                  )}
                >
                  {item.label}
                </Link>
              </div>
            ))}
          </nav>
        </header>
        <main className="min-h-[calc(100vh-3.5rem)] py-7 sm:py-10">
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
  const profileMenuRef = useRef<HTMLDetailsElement>(null);
  const isFocusRoute = /^\/projects\/[^/]+\/focus(?:\/|$)/.test(pathname);
  const isProjectRoute =
    (pathname.startsWith("/project/") || pathname.startsWith("/projects/")) && !isFocusRoute;

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const menu = profileMenuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) {
        menu.open = false;
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-3">
      <Link href="/dashboard" className="mb-3 flex min-h-10 items-center rounded-xl px-2 text-ink" onClick={onNavigate}>
        <span className="font-serif text-[1.35rem] leading-none">Sevri</span>
      </Link>

      <Link
        href="/onboarding"
        className="mb-5 flex h-9 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-[0_1px_2px_rgba(24,35,58,0.12)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover hover:shadow-[0_6px_18px_rgba(24,35,58,0.18)] active:translate-y-px"
        onClick={onNavigate}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Explore a project</span>
      </Link>

      <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Workspace</p>
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
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Current project</p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ProjectSidebarSlot pathname={pathname} />
          </div>
        </div>
      ) : <div className="flex-1" />}

      <details
        ref={profileMenuRef}
        className="group relative mt-3 border-t border-line pt-3"
        onMouseLeave={() => {
          if (profileMenuRef.current) profileMenuRef.current.open = false;
        }}
      >
        <summary className="user-tab cursor-pointer list-none hover:bg-surface-strong marker:hidden">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-semibold text-cream">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
            {email ? <p className="truncate text-xs text-ink-muted">{email}</p> : null}
          </div>
          <ChevronDown className="h-4 w-4 text-ink-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div
          className="absolute bottom-12 left-0 right-0 rounded-xl border border-line bg-paper p-1 shadow-lifted"
          onMouseLeave={() => {
            if (profileMenuRef.current) profileMenuRef.current.open = false;
          }}
        >
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

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/project/") || pathname.startsWith("/projects/")) return "Project workspace";
  if (pathname.startsWith("/recommendations")) return "Project ideas";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/portfolio")) return "Portfolio";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  return "Dashboard";
}

function getHeaderBreadcrumbs(pathname: string) {
  const projectMatch = pathname.match(/^\/projects?\/([^/]+)(?:\/(.*))?$/);
  if (projectMatch) {
    const [, projectId, remainder = ""] = projectMatch;
    const breadcrumbs = [
      { href: "/dashboard", label: "Dashboard" },
      { href: `/project/${projectId}`, label: "Project workspace" },
    ];
    const stepMatch = remainder.match(/^steps\/(\d+)/);

    if (stepMatch) {
      breadcrumbs.push({
        href: `/project/${projectId}/steps/${stepMatch[1]}`,
        label: `Step ${stepMatch[1]}`,
      });
    } else if (remainder === "scope") {
      breadcrumbs.push({ href: `/project/${projectId}/scope`, label: "Scope" });
    } else if (remainder === "research-lens") {
      breadcrumbs.push({ href: `/project/${projectId}/research-lens`, label: "Research lens" });
    } else if (remainder === "pitch-kit") {
      breadcrumbs.push({ href: `/project/${projectId}/pitch-kit`, label: "Pitch kit" });
    } else if (remainder === "focus") {
      breadcrumbs.push({ href: `/projects/${projectId}/focus`, label: "Focus" });
    }

    return breadcrumbs;
  }

  const pageLabel = getPageLabel(pathname);
  if (pathname === "/dashboard") return [{ href: "/dashboard", label: pageLabel }];

  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: pathname, label: pageLabel },
  ];
}
