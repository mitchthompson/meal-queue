"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

type NavLink = {
  href: string;
  label: string;
  icon: "today" | "recipes" | "plans" | "grocery" | "settings";
};

// The reflow tabbar (redesign-brief.md): the four cycle screens. Settings
// moved off the bar to a gear in the Today header — see design-flags.md.
const navLinks: NavLink[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/plans", label: "Plan", icon: "plans" },
  { href: "/grocery", label: "Shop", icon: "grocery" },
  { href: "/recipes", label: "Recipes", icon: "recipes" },
];

export function NavIcon({ name }: { name: NavLink["icon"] }) {
  if (name === "today") {
    return (
      <svg aria-hidden="true" className="mobile-tab-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "recipes") {
    return (
      <svg aria-hidden="true" className="mobile-tab-icon" viewBox="0 0 24 24">
        <path d="M6 4h12a2 2 0 0 1 2 2v12l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "plans") {
    return (
      <svg aria-hidden="true" className="mobile-tab-icon" viewBox="0 0 24 24">
        <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3v4M16 3v4M7 11h10M7 15h7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "grocery") {
    return (
      <svg aria-hidden="true" className="mobile-tab-icon" viewBox="0 0 24 24">
        <path d="M5 7h15l-1.7 7.5a2 2 0 0 1-2 1.5H9.1a2 2 0 0 1-2-1.5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 7 6 4H3M10 20a1.5 1.5 0 1 0 0 .01M17 20a1.5 1.5 0 1 0 0 .01" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="mobile-tab-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.7 6.7l1.6 1.6M15.7 15.7l1.6 1.6M17.3 6.7l-1.6 1.6M8.3 15.7l-1.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="shell">
      <nav className="nav-pills">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link aria-current={active ? "page" : undefined} className={active ? "pill active" : "pill"} href={link.href} key={link.href}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Primary mobile" className="mobile-tabbar">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              aria-label={link.label}
              aria-current={active ? "page" : undefined}
              className={active ? "mobile-tab active" : "mobile-tab"}
              href={link.href}
              key={`mobile-${link.href}`}
              title={link.label}
            >
              <NavIcon name={link.icon} />
              <span className="mobile-tab-label">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <section>{children}</section>
    </main>
  );
}
