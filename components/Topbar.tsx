"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProfile } from "@/lib/storage";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/studio", label: "สร้างแบบทดสอบ" },
  { href: "/join", label: "เข้าร่วมเกม" },
  { href: "/dna", label: "Learning DNA" },
];

export default function Topbar() {
  const path = usePathname();
  const [name, setName] = useState("");

  useEffect(() => {
    const sync = () => setName(loadProfile().name);
    sync();
    window.addEventListener("qv-profile", sync);
    return () => window.removeEventListener("qv-profile", sync);
  }, []);

  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/join" && path.startsWith("/play"));

  return (
    <header className="topbar">
      <div className="wrap">
        <Link className="brand" href="/" aria-label="QUIZVERSE หน้าแรก">
          <span className="brand-mark">Q</span>
          <span>
            <span className="brand-name">QUIZVERSE</span>
            <span className="brand-tag">Learn • Play • Challenge • Grow</span>
          </span>
        </Link>
        <nav className="nav" aria-label="เมนูหลัก">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "on" : ""}>{l.label}</Link>
          ))}
        </nav>
        <div className="me-chip">
          <div className="avatar">{(name || "S").charAt(0).toUpperCase()}</div>
          <span>{name}</span>
        </div>
      </div>
    </header>
  );
}
