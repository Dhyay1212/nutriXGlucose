"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  glucose: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  educator: <path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M12 3v4" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
};
const icon = (p: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
);

export default function Nav() {
  const path = usePathname();
  const tab = (href: string, label: string, ic: React.ReactNode) => (
    <Link href={href} className={"tab" + (path === href ? " active" : "")}>{icon(ic)}<span>{label}</span></Link>
  );
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand"><span className="logo">Nx</span>NutriX <span>Glucose</span></Link>
      </header>
      <nav className="tabbar" aria-label="Main">
        {tab("/", "Home", I.home)}
        {tab("/insights", "Insights", I.insights)}
        <Link href="/log" className={"tab fab" + (path === "/log" ? " active" : "")} aria-label="Snap a meal">
          <span className="fab-btn">{icon(I.camera)}</span><span>Snap</span>
        </Link>
        {tab("/glucose", "Glucose", I.glucose)}
        {tab("/educator", "Educator", I.educator)}
      </nav>
    </>
  );
}
