"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

type AppShellProps = {
  children: ReactNode;
  userEmail?: string;
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/plans", label: "Meal Plans" },
  { href: "/grocery", label: "Grocery" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Meal Queue</p>
          <p className="topbar-subtle">{userEmail ?? "Signed in"}</p>
        </div>
        <button className="secondary-btn" onClick={() => supabase.auth.signOut()} type="button">
          Sign out
        </button>
      </header>

      <nav className="nav-pills">
        {navLinks.map((link) => {
          const active = pathname === link.href;
          return (
            <Link className={active ? "pill active" : "pill"} href={link.href} key={link.href}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <section>{children}</section>
    </main>
  );
}
