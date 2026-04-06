"use client";

import type { FocusEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectSidebarSlot } from "@/components/project/project-sidebar-slot";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

const workspaceLinks = [
  { href: "/dashboard", label: "Dashboard", match: (pathname: string) => pathname === "/dashboard" },
  { href: "/recommendations", label: "Recommendations", match: (pathname: string) => pathname.startsWith("/recommendations") },
  { href: "/onboarding", label: "Project Profile", match: (pathname: string) => pathname.startsWith("/onboarding") },
  { href: "/billing", label: "Billing", match: (pathname: string) => pathname.startsWith("/billing") },
] as const;

interface AppShellClientProps {
  children: ReactNode;
  displayName: string;
  email?: string | null;
}

export function AppShellClient({ children, displayName, email }: AppShellClientProps) {
  const pathname = usePathname();
  const desktopSidebarId = useId();
  const mobileSidebarId = `${desktopSidebarId}-mobile`;
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopSidebarRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const desktopFlyoutOpenRef = useRef(false);
  const mobileDrawerOpenRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isDesktopFlyoutOpen, setIsDesktopFlyoutOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    desktopFlyoutOpenRef.current = isDesktopFlyoutOpen;
  }, [isDesktopFlyoutOpen]);

  useEffect(() => {
    mobileDrawerOpenRef.current = isMobileDrawerOpen;
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncIsDesktop = () => setIsDesktop(mediaQuery.matches);

    syncIsDesktop();
    mediaQuery.addEventListener("change", syncIsDesktop);

    return () => {
      mediaQuery.removeEventListener("change", syncIsDesktop);
    };
  }, []);

  useEffect(() => {
    clearDesktopCloseTimer();
    setIsDesktopFlyoutOpen(false);
    setIsMobileDrawerOpen(false);
    previousFocusRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (isDesktop) {
      setIsMobileDrawerOpen(false);
      return;
    }

    clearDesktopCloseTimer();
    setIsDesktopFlyoutOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      const previousFocus = previousFocusRef.current;

      if (mobileDrawerOpenRef.current) {
        setIsMobileDrawerOpen(false);
      }

      if (desktopFlyoutOpenRef.current) {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }

        setIsDesktopFlyoutOpen(false);
      }

      if (previousFocus) {
        previousFocusRef.current = null;
        window.requestAnimationFrame(() => {
          previousFocus.focus();
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function clearDesktopCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function restorePreviousFocus() {
    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;

    if (!previousFocus) {
      return;
    }

    window.requestAnimationFrame(() => {
      previousFocus.focus();
    });
  }

  function openDesktopNavigation(trigger?: HTMLElement | null) {
    if (!isDesktop) {
      return;
    }

    clearDesktopCloseTimer();
    if (trigger) {
      previousFocusRef.current = trigger;
    }
    setIsDesktopFlyoutOpen(true);
  }

  function closeDesktopNavigation(shouldRestoreFocus = false) {
    clearDesktopCloseTimer();
    setIsDesktopFlyoutOpen(false);

    if (shouldRestoreFocus) {
      restorePreviousFocus();
    }
  }

  function scheduleDesktopClose() {
    if (!isDesktop) {
      return;
    }

    clearDesktopCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      const activeElement = document.activeElement;

      if (
        activeElement &&
        (desktopSidebarRef.current?.contains(activeElement) || desktopTriggerRef.current?.contains(activeElement))
      ) {
        return;
      }

      setIsDesktopFlyoutOpen(false);
    }, 140);
  }

  function openMobileDrawer() {
    previousFocusRef.current = mobileTriggerRef.current;
    setIsMobileDrawerOpen(true);
  }

  function closeMobileDrawer(shouldRestoreFocus = false) {
    setIsMobileDrawerOpen(false);

    if (shouldRestoreFocus) {
      restorePreviousFocus();
    }
  }

  function handleDesktopTriggerBlur(event: FocusEvent<HTMLButtonElement>) {
    const nextFocusedElement = event.relatedTarget as Node | null;

    if (
      nextFocusedElement &&
      (desktopSidebarRef.current?.contains(nextFocusedElement) || desktopTriggerRef.current?.contains(nextFocusedElement))
    ) {
      return;
    }

    scheduleDesktopClose();
  }

  function handleDesktopSidebarBlur(event: FocusEvent<HTMLElement>) {
    const nextFocusedElement = event.relatedTarget as Node | null;

    if (
      nextFocusedElement &&
      (desktopSidebarRef.current?.contains(nextFocusedElement) || desktopTriggerRef.current?.contains(nextFocusedElement))
    ) {
      return;
    }

    scheduleDesktopClose();
  }

  const initials = getInitials(displayName);

  return (
    <div className="relative min-h-screen">
      <button
        ref={desktopTriggerRef}
        type="button"
        className={cn(
          "fixed left-4 top-4 z-[70] hidden h-11 w-11 items-center justify-center rounded-2xl border border-line bg-paper/94 text-ink shadow-soft backdrop-blur transition hover:border-line-strong hover:bg-paper lg:inline-flex",
          isDesktopFlyoutOpen && "border-line-strong bg-paper",
        )}
        aria-label={isDesktopFlyoutOpen ? "Close workspace navigation" : "Open workspace navigation"}
        aria-expanded={isDesktopFlyoutOpen}
        aria-controls={desktopSidebarId}
        onMouseEnter={() => openDesktopNavigation()}
        onMouseLeave={scheduleDesktopClose}
        onFocus={(event) => openDesktopNavigation(event.currentTarget)}
        onBlur={handleDesktopTriggerBlur}
        onClick={(event) => {
          if (isDesktopFlyoutOpen) {
            previousFocusRef.current = event.currentTarget;
            closeDesktopNavigation(true);
            return;
          }

          openDesktopNavigation(event.currentTarget);
        }}
      >
        <MenuIcon />
      </button>

      <button
        ref={mobileTriggerRef}
        type="button"
        className="fixed left-4 top-4 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-paper/94 text-ink shadow-soft backdrop-blur transition hover:border-line-strong hover:bg-paper lg:hidden"
        aria-label={isMobileDrawerOpen ? "Close workspace navigation" : "Open workspace navigation"}
        aria-expanded={isMobileDrawerOpen}
        aria-controls={mobileSidebarId}
        onClick={() => {
          if (isMobileDrawerOpen) {
            closeMobileDrawer(true);
            return;
          }

          openMobileDrawer();
        }}
      >
        <MenuIcon />
      </button>

      {isMobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-ink/22 backdrop-blur-[1px] lg:hidden"
          aria-label="Dismiss workspace navigation"
          onClick={() => closeMobileDrawer(true)}
        />
      ) : null}

      <aside
        id={desktopSidebarId}
        ref={desktopSidebarRef}
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[65] hidden w-[16rem] flex-col overflow-hidden border-r border-line text-ink backdrop-blur-md transition-transform duration-200 ease-out lg:flex",
          isDesktopFlyoutOpen ? "visible translate-x-0 pointer-events-auto" : "invisible pointer-events-none -translate-x-[calc(100%+1rem)]",
        )}
        onMouseEnter={() => openDesktopNavigation()}
        onMouseLeave={scheduleDesktopClose}
        onFocusCapture={() => openDesktopNavigation()}
        onBlurCapture={handleDesktopSidebarBlur}
      >
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={() => closeDesktopNavigation(false)}
          onClose={() => closeDesktopNavigation(true)}
          showCloseButton={false}
        />
      </aside>

      <aside
        id={mobileSidebarId}
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[60] flex w-[16rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-r border-line text-ink backdrop-blur-md transition-transform duration-200 ease-out lg:hidden",
          isMobileDrawerOpen ? "visible translate-x-0 pointer-events-auto" : "invisible pointer-events-none -translate-x-[105%]",
        )}
      >
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={() => closeMobileDrawer(false)}
          onClose={() => closeMobileDrawer(true)}
          showCloseButton
        />
      </aside>

      <main className="min-h-screen pb-14 pt-20 sm:pb-20 lg:pt-20">
        <Container>
          <PageTransition transitionKey={pathname}>{children}</PageTransition>
        </Container>
      </main>
    </div>
  );
}

interface SidebarContentProps {
  displayName: string;
  email?: string | null;
  initials: string;
  pathname: string;
  onNavigate: () => void;
  onClose: () => void;
  showCloseButton: boolean;
}

function SidebarContent({
  displayName,
  email,
  initials,
  pathname,
  onNavigate,
  onClose,
  showCloseButton,
}: SidebarContentProps) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className="flex min-h-full flex-col">
        <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-5">
          <Link
            href="/dashboard"
            className="rounded-2xl px-1 py-1 transition hover:bg-surface/80 focus-visible:outline-none"
            data-sidebar-autofocus
            onClick={onNavigate}
          >
            <span className="block font-display text-[2rem] leading-none text-ink">Sevri</span>
            <span className="mt-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted">
              Your Workspace
            </span>
          </Link>

          {showCloseButton ? (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-ink transition hover:border-line-strong hover:bg-surface/72"
              aria-label="Close navigation drawer"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <div className="px-4">
          <SidebarSectionLabel label="Workspace" />
        </div>

        <nav className="mt-2 space-y-1 px-3" aria-label="Workspace navigation">
          {workspaceLinks.map((link) => (
            <SidebarLink
              key={link.href}
              href={link.href}
              label={link.label}
              isActive={link.match(pathname)}
              onClick={onNavigate}
            />
          ))}
        </nav>

        <ProjectSidebarSection pathname={pathname} />

        <div className="mt-auto p-4">
          <div className="rounded-[1.4rem] border border-line bg-canvas/72 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-sm font-semibold text-ink">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                {email ? <p className="truncate text-xs text-ink-muted">{email}</p> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <Button
                href="/settings"
                variant="ghost"
                className="justify-start rounded-xl border border-transparent px-3 text-sm text-ink hover:border-line hover:bg-paper/78"
                onClick={onNavigate}
              >
                Account settings
              </Button>
              <form action="/auth/sign-out" method="post">
                <Button
                  type="submit"
                  variant="outline"
                  fullWidth
                  className="justify-start rounded-xl border-line bg-paper/82 px-3 text-sm hover:bg-paper"
                >
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectSidebarSection({ pathname }: { pathname: string }) {
  const isProjectRoute = pathname.startsWith("/project/");

  if (!isProjectRoute) {
    return null;
  }

  return (
    <div className="px-4 pt-5">
      <SidebarSectionLabel label="Project context" />
      <div className="mt-3 rounded-2xl border border-line bg-canvas/68 p-3">
        <ProjectSidebarSlot pathname={pathname} />
      </div>
    </div>
  );
}

function SidebarSectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-muted">{label}</span>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}

function SidebarLink({
  href,
  label,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-2xl border px-3 py-3 text-sm transition",
        isActive
          ? "border-line-strong bg-paper text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
          : "border-transparent text-ink-soft hover:border-line hover:bg-paper/76 hover:text-ink",
      )}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
    >
      <span className="font-medium">{label}</span>
      {isActive ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
    </Link>
  );
}

function getInitials(displayName: string) {
  const parts = displayName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "SS";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M4.5 5.75h11" strokeLinecap="round" />
      <path d="M4.5 10h11" strokeLinecap="round" />
      <path d="M4.5 14.25h11" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6 18 18" strokeLinecap="round" />
      <path d="M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
