"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Key = "dashboard" | "studio" | "bank" | "report" | "live";
const ITEMS: { key: Key; href: string; label: string }[] = [
  { key: "dashboard", href: "/teacher", label: "แดชบอร์ด" },
  { key: "studio", href: "/studio", label: "สร้าง Quiz" },
  { key: "bank", href: "/teacher#bank", label: "คลังข้อสอบ" },
  { key: "report", href: "/teacher#reports", label: "รายงานผล" },
  { key: "live", href: "/join", label: "ห้องเรียน (เปิดห้องสด)" },
];

/** Scrolls to a dashboard section, waiting for it to render (data loads after navigation). */
export function scrollToSection(id: string, tries = 40) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // fallback: some browsers skip smooth scrolling (background tabs, power saving) — jump if we did not get there
    setTimeout(() => {
      const off = Math.abs(el.getBoundingClientRect().top - 90);
      const canScroll = window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 2;
      if (off > 40 && canScroll) el.scrollIntoView({ block: "start" });
    }, 700);
    return;
  }
  if (tries > 0) setTimeout(() => scrollToSection(id, tries - 1), 150);
}

/** Left-hand teacher menu from the mockup (dashboard, Studio, question bank, reports, live rooms). */
export default function TeacherNav({ active }: { active: Key }) {
  const path = usePathname();
  const router = useRouter();

  function go(e: React.MouseEvent, href: string) {
    const [page, hash] = href.split("#");
    if (!hash) return; // normal link
    e.preventDefault();
    if (path === page) {
      history.replaceState(null, "", `#${hash}`);
      window.dispatchEvent(new HashChangeEvent("hashchange")); // replaceState does not fire it; the page uses it to highlight the menu
      scrollToSection(hash);
    } else {
      router.push(href, { scroll: false }); // the dashboard scrolls to the section itself once its data has loaded
    }
  }

  return (
    <aside className="side" aria-label="เมนูผู้สอน">
      {ITEMS.map((it) => (
        <Link key={it.key} href={it.href} onClick={(e) => go(e, it.href)}
          className={"s-item" + (active === it.key ? " on" : "")} aria-current={active === it.key ? "page" : undefined}>
          {it.label}
        </Link>
      ))}
    </aside>
  );
}
