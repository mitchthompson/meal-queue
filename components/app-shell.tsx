"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string;
};

type NavLink = {
  href: string;
  label: string;
  icon: "home" | "recipes" | "plans" | "grocery" | "settings";
};

const navLinks: NavLink[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/recipes", label: "Recipes", icon: "recipes" },
  { href: "/plans", label: "Meal Plans", icon: "plans" },
  { href: "/grocery", label: "Grocery", icon: "grocery" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function NavIcon({ name }: { name: NavLink["icon"] }) {
  if (name === "home") {
    return (
      <svg aria-hidden="true" className="mobile-tab-icon" viewBox="0 0 24 24">
        <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" />
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

export function AppShell({ children, userEmail }: AppShellProps) {
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
            </Link>
          );
        })}
      </nav>

      <section>{children}</section>
    </main>
  );
}
