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

type SectionKey = "pages" | "project" | "account";

export function AppShellClient({ children, displayName, email }: AppShellClientProps) {
  const pathname = usePathname();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    pages: true,
    project: true,
    account: true,
  });
  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
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
        className="fixed left-4 top-4 z-[70] inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-soft transition hover:bg-surface lg:hidden"
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
      <aside className="app-sidebar-shell fixed inset-y-0 left-0 z-[65] hidden w-[var(--app-sidebar-width)] flex-col overflow-y-hidden lg:flex">
        <SidebarContent
          displayName={displayName}
          email={email}
          initials={initials}
          pathname={pathname}
          onNavigate={() => {}}
          showCloseButton={false}
          onClose={() => {}}
          openSections={openSections}
          onToggleSection={toggleSection}
        />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "app-sidebar-shell fixed inset-y-0 left-0 z-[60] flex w-[var(--app-sidebar-width)] max-w-[calc(100vw-1rem)] flex-col overflow-y-hidden text-ink transition-transform duration-200 ease-out lg:hidden",
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
          openSections={openSections}
          onToggleSection={toggleSection}
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
  openSections: Record<SectionKey, boolean>;
  onToggleSection: (key: SectionKey) => void;
}

function SidebarContent({
  displayName,
  initials,
  pathname,
  onNavigate,
  onClose,
  showCloseButton,
  openSections,
  onToggleSection,
}: SidebarContentProps) {
  const isProjectRoute = pathname.startsWith("/project/");

  return (
    <div className="flex h-full min-h-0 flex-col p-4" style={{ gap: 0 }}>
      {/* User tab */}
      <div className="user-tab mb-1">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy font-display text-sm font-semibold text-cream">
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">
            {displayName}
          </div>
          <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Workspace
          </div>
        </div>
        {showCloseButton ? (
          <button
            type="button"
            className="shrink-0 rounded-full p-1 text-ink transition hover:bg-canvas"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      {/* Pages section */}
      <CollapsibleHeader
        label="pages"
        sectionId="sidebar-section-pages"
        open={openSections.pages}
        onToggle={() => onToggleSection("pages")}
      />
      {openSections.pages ? (
        <div id="sidebar-section-pages" className="flex flex-col gap-1">
          {workspaceLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn("tab", link.match(pathname) && "is-active")}
              onClick={onNavigate}
            >
              <span className="w-[18px] shrink-0 text-center font-mono text-xs">
                {link.ico}
              </span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {/* Project header (only on project routes) */}
      {isProjectRoute ? (
        <CollapsibleHeader
          label="project"
          sectionId="sidebar-section-project"
          open={openSections.project}
          onToggle={() => onToggleSection("project")}
        />
      ) : null}

      {/* Spacer / scrollable project content — keeps account pinned to bottom */}
      <div
        id={isProjectRoute ? "sidebar-section-project" : undefined}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: isProjectRoute && openSections.project ? 'auto' : 'hidden',
          marginRight: -12,
          paddingRight: 8,
        }}
      >
        {isProjectRoute && openSections.project ? (
          <ProjectSidebarSlot pathname={pathname} />
        ) : null}
      </div>

      {/* Account section pinned to bottom */}
      <div style={{ paddingTop: 16 }}>
        <CollapsibleHeader
          label="account"
          sectionId="sidebar-section-account"
          open={openSections.account}
          onToggle={() => onToggleSection("account")}
          style={{ marginTop: 0 }}
        />
        {openSections.account ? (
          <div id="sidebar-section-account" className="flex flex-col gap-1">
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
        ) : null}
      </div>
    </div>
  );
}

function CollapsibleHeader({
  label,
  sectionId,
  open,
  onToggle,
  style,
}: {
  label: string;
  sectionId: string;
  open: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className="sidebar-section-label group"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={sectionId}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--ink-muted)',
        textAlign: 'left',
        width: '100%',
        ...style,
      }}
    >
      <span>{label}</span>
      <span className="dashes" />
      <CaretIcon open={open} />
    </button>
  );
}

function CaretIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      className={cn("shrink-0 text-ink-muted transition-transform duration-150", open ? "rotate-0" : "-rotate-90")}
    >
      <path
        d="M3 4.5 6 8 9 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
