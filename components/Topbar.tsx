"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadProfile } from "@/lib/storage";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMe } from "@/lib/useMe";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/studio", label: "สร้างแบบทดสอบ" },
  { href: "/join", label: "เข้าร่วมเกม" },
  { href: "/quest", label: "Learning Quest" },
  { href: "/dna", label: "Learning DNA" },
];

export default function Topbar() {
  const path = usePathname();
  const router = useRouter();
  const { me, loading } = useMe();
  const sb = supabaseBrowser();
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    const sync = () => setGuestName(loadProfile().name);
    sync();
    window.addEventListener("qv-profile", sync);
    return () => window.removeEventListener("qv-profile", sync);
  }, []);

  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/join" && path.startsWith("/play")) || (href === "/dna" && path.startsWith("/practice"));
  const name = me?.name || guestName;

  async function logout() {
    await sb?.auth.signOut();
    router.push("/");
    router.refresh();
  }

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
          {me?.role === "teacher" && <Link href="/teacher" className={path.startsWith("/teacher") ? "on" : ""}>แดชบอร์ดครู</Link>}
        </nav>
        <div className="me-chip">
          <div className="avatar">{(name || "S").charAt(0).toUpperCase()}</div>
          <span>{name}{me && <> · {me.role === "teacher" ? "ครู" : "นักเรียน"}</>}</span>
          {sb && !loading && (me
            ? <button className="btn btn-ghost btn-sm" onClick={logout}>ออกจากระบบ</button>
            : <Link className="btn btn-soft btn-sm" href="/login">เข้าสู่ระบบ</Link>)}
        </div>
      </div>
    </header>
  );
}
