"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/teacher", label: "แดชบอร์ด" },
  { href: "/studio", label: "สร้าง Quiz" },
  { href: "/teacher#bank", label: "คลังข้อสอบ" },
  { href: "/teacher#bank", label: "รายงานผล" },
  { href: "/join", label: "ห้องเรียน (เปิดห้องสด)" },
];

/** Left-hand teacher menu from the mockup (Studio, dashboard, question bank, reports). */
export default function TeacherNav({ active }: { active: "dashboard" | "studio" | "bank" | "report" }) {
  const path = usePathname();
  const on = (i: number) =>
    (active === "dashboard" && i === 0) || (active === "studio" && i === 1) || (active === "bank" && i === 2) || (active === "report" && i === 3) || (i === 4 && path.startsWith("/join"));
  return (
    <aside className="side" aria-label="เมนูผู้สอน">
      {ITEMS.map((it, i) => (
        <Link key={it.label} href={it.href} className={"s-item" + (on(i) ? " on" : "")} style={{ color: "inherit", textDecoration: "none" }}>
          {it.label}
        </Link>
      ))}
    </aside>
  );
}
