"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/log", label: "Snap meal" },
  { href: "/glucose", label: "Glucose" },
  { href: "/insights", label: "Insights" },
  { href: "/educator", label: "Educator" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <Link href="/" className="brand">NutriX <span>Glucose</span></Link>
      <nav>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>{l.label}</Link>
        ))}
      </nav>
    </header>
  );
}
