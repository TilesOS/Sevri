"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectSidebarSlot } from "@/components/project/project-sidebar-slot";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

const workspaceLinks = [
  { href: "/dashboard",       label: "dashboard",   ico: "☐", match: (p: string) => p === "/dashboard" },
  { href: "/calendar",        label: "calendar",    ico: "◻", match: (p: string) => p.startsWith("/calendar") },
  { href: "/portfolio",       label: "portfolio",   ico: "◐", match: (p: string) => p.startsWith("/portfolio") },
  { href: "/recommendations", label: "ideas",       ico: "✦", match: (p: string) => p.startsWith("/recommendations") },
  { href: "/onboarding",      label: "onboarding",  ico: "↗", match: (p: string) => p.startsWith("/onboarding") },
] as const;

interface AppShellClientProps {
  children: ReactNode;
  displayName: string;
  email?: string | null;
}

export function AppShellClient({ children, displayName, email }: AppShellClientProps) {
  const pathname = usePathname();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const initials = getInitials(displayName);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
        mobileTriggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileDrawerOpen]);

  return (
    <div className="relative min-h-screen">
      {/* Mobile trigger */}
      <button
        ref={mobileTriggerRef}
        type="button"
        className="fixed left-4 top-4 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-md border-2 border-ink bg-paper text-ink shadow-soft lg:hidden"
        aria-label={isMobileDrawerOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isMobileDrawerOpen}
        onClick={() => setIsMobileDrawerOpen((v) => !v)}
      >
        <MenuIcon />
      </button>

      {/* Mobile backdrop */}
      {isMobileDrawerOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-ink/22 backdrop-blur-[1px] lg:hidden"
          aria-label="Dismiss navigation"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      ) : null}

      {/* Desktop sidebar — always visible */}
      <aside className="app-sidebar-shell fixed inset-y-0 left-0 z-[65] hidden w-[var(--app-sidebar-width)] flex-col overflow-y-auto lg:flex">
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={() => {}}
          showCloseButton={false}
          onClose={() => {}}
        />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[60] flex w-[var(--app-sidebar-width)] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto text-ink transition-transform duration-200 ease-out lg:hidden",
          isMobileDrawerOpen ? "translate-x-0" : "-translate-x-[105%]",
        )}
      >
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={() => setIsMobileDrawerOpen(false)}
          onClose={() => setIsMobileDrawerOpen(false)}
          showCloseButton
        />
      </aside>

      {/* Main content — always offset on desktop */}
      <div className="relative min-h-screen lg:ml-[var(--app-sidebar-width)]">
        <main className="min-h-screen pb-14 pt-20 sm:pb-20 lg:pt-10">
          <Container>
            <PageTransition transitionKey={pathname}>{children}</PageTransition>
          </Container>
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
  onNavigate: () => void;
  onClose: () => void;
  showCloseButton: boolean;
}

function SidebarContent({
  displayName,
  initials,
  pathname,
  onNavigate,
  onClose,
  showCloseButton,
}: SidebarContentProps) {
  return (
    <div className="flex h-full min-h-0 flex-col p-4" style={{ gap: 0 }}>
      {/* User tab */}
      <div className="user-tab" style={{ marginBottom: 4 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          border: '2px solid var(--ink)',
          background: 'var(--paper)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 15, fontWeight: 900, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ lineHeight: 1.2, minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em', color: 'var(--ink-soft)', marginTop: 2, textTransform: 'uppercase' }}>
            Workspace
          </div>
        </div>
        {showCloseButton ? (
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink)', flexShrink: 0 }}
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      {/* Pages section */}
      <div className="hand-label">~ pages ~ <span className="dashes" /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {workspaceLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn("tab", link.match(pathname) && "is-active")}
            onClick={onNavigate}
          >
            <span style={{ width: 18, textAlign: 'center', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {link.ico}
            </span>
            <span>{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Project context (only on project routes) */}
      <ProjectSidebarSection pathname={pathname} />

      {/* Account section pinned to bottom */}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <div className="hand-label" style={{ marginTop: 0 }}>~ account ~ <span className="dashes" /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/settings"
            className="tab flat"
            onClick={onNavigate}
            style={{ fontSize: 13 }}
          >
            <span style={{ width: 18, textAlign: 'center', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>⚙</span>
            <span>settings</span>
          </Link>
          <form action="/auth/sign-out" method="post" style={{ width: '100%' }}>
            <button type="submit" className="tab flat" style={{ fontSize: 13 }}>
              <span style={{ width: 18, textAlign: 'center', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>→</span>
              <span>sign out</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ProjectSidebarSection({ pathname }: { pathname: string }) {
  if (!pathname.startsWith("/project/")) return null;

  return (
    <div style={{ paddingTop: 4 }}>
      <div className="hand-label">~ project ~ <span className="dashes" /></div>
      <div style={{
        border: '2px solid var(--line)',
        borderRadius: 6,
        padding: 12,
        background: 'var(--paper)',
      }}>
        <ProjectSidebarSlot pathname={pathname} />
      </div>
    </div>
  );
}

function getInitials(displayName: string) {
  const parts = displayName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "SS";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9">
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
