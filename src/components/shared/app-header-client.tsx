"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "sevri.app-sidebar.pinned";

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard", match: (pathname: string) => pathname === "/dashboard" },
  { href: "/recommendations", label: "Recommendations", match: (pathname: string) => pathname.startsWith("/recommendations") },
  { href: "/billing", label: "Billing", match: (pathname: string) => pathname.startsWith("/billing") },
  { href: "/settings", label: "Settings", match: (pathname: string) => pathname.startsWith("/settings") },
] as const;

const secondaryLinks = [
  { href: "/onboarding", label: "Profile & Interests", match: (pathname: string) => pathname.startsWith("/onboarding") },
] as const;

interface AppShellClientProps {
  children: ReactNode;
  displayName: string;
  email?: string | null;
  secondaryNavigation?: ReactNode;
}

export function AppShellClient({
  children,
  displayName,
  email,
  secondaryNavigation,
}: AppShellClientProps) {
  const pathname = usePathname();
  const sidebarId = useId();
  const edgeTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isPinned, setIsPinned] = useState(true);
  const [isDesktopOverlayOpen, setIsDesktopOverlayOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

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
    const storedPreference = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedPreference === "false") {
      setIsPinned(false);
      return;
    }

    if (storedPreference === "true") {
      setIsPinned(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isPinned));
  }, [isPinned]);

  useEffect(() => {
    setIsDesktopOverlayOpen(false);
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isDesktop) {
      setIsMobileDrawerOpen(false);
      return;
    }

    setIsDesktopOverlayOpen(false);
  }, [isDesktop]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }

      if (isDesktopOverlayOpen) {
        setIsDesktopOverlayOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDesktopOverlayOpen, isMobileDrawerOpen]);

  useEffect(() => {
    const shouldFocusSidebar =
      isMobileDrawerOpen || (isDesktop && isDesktopOverlayOpen && !isPinned && previousFocusRef.current !== null);
    if (!shouldFocusSidebar) {
      return;
    }

    const focusTarget = sidebarRef.current?.querySelector<HTMLElement>(
      "[data-sidebar-autofocus], a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );

    focusTarget?.focus();
  }, [isDesktop, isDesktopOverlayOpen, isMobileDrawerOpen, isPinned]);

  useEffect(() => {
    if (isMobileDrawerOpen || (isDesktop && isDesktopOverlayOpen && !isPinned)) {
      return;
    }

    const previousFocus = previousFocusRef.current;
    previousFocusRef.current = null;
    previousFocus?.focus();
  }, [isDesktop, isDesktopOverlayOpen, isMobileDrawerOpen, isPinned]);

  const isOverlayVisible = !isPinned && isDesktopOverlayOpen;
  const initials = getInitials(displayName);

  function openDesktopOverlay(trigger?: HTMLElement | null) {
    if (!isDesktop || isPinned) {
      return;
    }

    previousFocusRef.current = trigger ?? null;
    setIsDesktopOverlayOpen(true);
  }

  function openMobileDrawer() {
    previousFocusRef.current = mobileTriggerRef.current;
    setIsMobileDrawerOpen(true);
  }

  function closeNavigation() {
    setIsDesktopOverlayOpen(false);
    setIsMobileDrawerOpen(false);
  }

  function pinSidebar() {
    previousFocusRef.current = null;
    setIsPinned(true);
    setIsDesktopOverlayOpen(false);
  }

  function collapseSidebar() {
    previousFocusRef.current = edgeTriggerRef.current;
    setIsPinned(false);
    setIsDesktopOverlayOpen(false);
  }

  return (
    <div className="relative min-h-screen">
      <button
        ref={mobileTriggerRef}
        type="button"
        className="fixed left-4 top-4 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper/92 text-ink shadow-soft transition hover:border-line-strong hover:bg-paper lg:hidden"
        aria-label={isMobileDrawerOpen ? "Close workspace navigation" : "Open workspace navigation"}
        aria-expanded={isMobileDrawerOpen}
        aria-controls={sidebarId}
        onClick={() => {
          if (isMobileDrawerOpen) {
            closeNavigation();
            return;
          }

          openMobileDrawer();
        }}
      >
        <MenuIcon />
      </button>

      {!isPinned ? (
        <button
          ref={edgeTriggerRef}
          type="button"
          className="fixed left-0 top-24 z-40 hidden h-24 w-5 items-center justify-center border-y border-r border-line bg-paper/92 text-ink transition hover:bg-surface/88 lg:inline-flex"
          aria-label={isOverlayVisible ? "Close workspace navigation overlay" : "Reveal workspace navigation"}
          aria-expanded={isOverlayVisible}
          aria-controls={sidebarId}
          onMouseEnter={() => openDesktopOverlay()}
          onFocus={(event) => openDesktopOverlay(event.currentTarget)}
          onClick={(event) => {
            if (isOverlayVisible) {
              setIsDesktopOverlayOpen(false);
              return;
            }

            openDesktopOverlay(event.currentTarget);
          }}
        >
          <div className="flex rotate-180 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.24em] [writing-mode:vertical-rl]">
            <span>Menu</span>
            <span aria-hidden="true">||</span>
          </div>
        </button>
      ) : null}

      {isMobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-ink/22 backdrop-blur-[1px] lg:hidden"
          aria-label="Dismiss workspace navigation"
          onClick={closeNavigation}
        />
      ) : null}

      {isOverlayVisible ? (
        <button
          type="button"
          className="fixed inset-0 z-40 hidden bg-transparent lg:block"
          aria-label="Dismiss workspace navigation overlay"
          onClick={closeNavigation}
        />
      ) : null}

      <aside
        id={sidebarId}
        ref={sidebarRef}
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[60] hidden w-[15rem] flex-col border-r border-line bg-paper/95 text-ink backdrop-blur-md transition-transform duration-200 ease-out lg:z-50",
          isPinned && "lg:flex lg:translate-x-0",
          !isPinned && "lg:flex lg:-translate-x-full",
          !isPinned && isOverlayVisible && "lg:translate-x-0",
          isMobileDrawerOpen && "flex translate-x-0",
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeNavigation();
          }
        }}
      >
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          isPinned={isPinned}
          isDesktop={isDesktop}
          secondaryNavigation={secondaryNavigation}
          onNavigate={closeNavigation}
          onCollapse={collapseSidebar}
          onPin={pinSidebar}
          onClose={closeNavigation}
        />
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200 ease-out",
          isPinned ? "lg:pl-[15rem]" : "lg:pl-0",
        )}
      >
        <main
          className="min-h-screen pb-14 pt-20 sm:pb-20 lg:pt-8"
          onClick={() => {
            if (isDesktopOverlayOpen || isMobileDrawerOpen) {
              closeNavigation();
            }
          }}
        >
          <Container>{children}</Container>
        </main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  displayName: string;
  email?: string | null;
  initials: string;
  pathname: string;
  isPinned: boolean;
  isDesktop: boolean;
  secondaryNavigation?: ReactNode;
  onNavigate: () => void;
  onCollapse: () => void;
  onPin: () => void;
  onClose: () => void;
}

function SidebarContent({
  displayName,
  email,
  initials,
  pathname,
  isPinned,
  isDesktop,
  secondaryNavigation,
  onNavigate,
  onCollapse,
  onPin,
  onClose,
}: SidebarContentProps) {
  return (
    <>
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

        <div className="flex items-center gap-2">
          {isDesktop ? (
            isPinned ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-ink transition hover:border-line-strong hover:bg-surface/72"
                aria-label="Collapse sidebar"
                onClick={onCollapse}
              >
                <PanelCloseIcon />
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-paper px-3 text-sm font-semibold text-ink transition hover:border-line-strong hover:bg-surface/72"
                aria-label="Pin sidebar open"
                onClick={onPin}
              >
                <PinIcon />
                <span>Pin</span>
              </button>
            )
          ) : (
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper text-ink transition hover:border-line-strong hover:bg-surface/72"
              aria-label="Close navigation drawer"
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="px-4">
        <SidebarSectionLabel label="Workspace" />
      </div>

      <nav className="mt-2 space-y-1 px-3" aria-label="Workspace navigation">
        {primaryLinks.map((link) => (
          <SidebarLink
            key={link.href}
            href={link.href}
            label={link.label}
            isActive={link.match(pathname)}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {secondaryNavigation ? (
        <div className="px-4 pt-5">
          <SidebarSectionLabel label="Project context" />
          <div className="mt-3 rounded-2xl border border-line bg-canvas/68 p-3">{secondaryNavigation}</div>
        </div>
      ) : null}

      <div className="px-4 pt-5">
        <SidebarSectionLabel label="Account" />
      </div>

      <div className="mt-2 space-y-1 px-3">
        {secondaryLinks.map((link) => (
          <SidebarLink
            key={link.href}
            href={link.href}
            label={link.label}
            isActive={link.match(pathname)}
            onClick={onNavigate}
          />
        ))}
      </div>

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
    </>
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
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M4 12h16" strokeLinecap="round" />
      <path d="M4 17h12" strokeLinecap="round" />
    </svg>
  );
}

function PanelCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4.5" y="5" width="15" height="14" rx="2" />
      <path d="M10 5v14" strokeLinecap="round" />
      <path d="m14.5 12 3-2.5v5l-3-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 4.5h6" strokeLinecap="round" />
      <path d="m8 10 8-5 0 0v4l2.5 2.5v.5H5.5v-.5L8 9Z" />
      <path d="M12 12v7.5" strokeLinecap="round" />
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
