"use client";
import Link from "next/link";
import SoundToggle from "./SoundToggle";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadProfile } from "@/lib/storage";
import { supabaseBrowser } from "@/lib/supabase/client";
import { effectiveTheme, getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import { useMe } from "@/lib/useMe";

const LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/studio", label: "สร้างแบบทดสอบ" },
  { href: "/join", label: "เข้าร่วมเกม" },
  { href: "/quest", label: "Learning Quest" },
  { href: "/dna", label: "Learning DNA" },
];

const Sun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);

export default function Topbar() {
  const path = usePathname();
  const router = useRouter();
  const { me, loading } = useMe();
  const sb = supabaseBrowser();
  const [guestName, setGuestName] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pref, setPref] = useState<ThemePref>("system");
  const [dark, setDark] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setGuestName(loadProfile().name);
    sync();
    window.addEventListener("qv-profile", sync);
    return () => window.removeEventListener("qv-profile", sync);
  }, []);

  // theme: follow the device unless the user picked one
  useEffect(() => {
    const sync = () => { const p = getThemePref(); setPref(p); setDark(effectiveTheme(p) === "dark"); };
    sync();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", sync);
    window.addEventListener("qv-theme", sync);
    return () => { mq?.removeEventListener?.("change", sync); window.removeEventListener("qv-theme", sync); };
  }, []);

  // close menus on navigation, Escape or outside click
  useEffect(() => { setDrawer(false); setMenu(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setDrawer(false); setMenu(false); } };
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, []);

  const links = me?.role === "teacher" ? [...LINKS, { href: "/teacher", label: "แดชบอร์ดครู" }] : LINKS;
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/join" && (path.startsWith("/play") || path.startsWith("/live")))
      || (href === "/dna" && path.startsWith("/practice"));
  const name = me?.name || guestName || "ผู้เล่น";
  const toggleTheme = () => setThemePref(dark ? "light" : "dark");

  async function logout() {
    await sb?.auth.signOut();
    setMenu(false); setDrawer(false);
    router.push("/");
    router.refresh();
  }

  const userBlock = (
    <>
      <div className="menu-head">
        <div className="avatar">{name.charAt(0).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <b style={{ display: "block", overflowWrap: "anywhere" }}>{name}</b>
          <span className="small muted">{me ? (me.role === "teacher" ? "บัญชีครู" : "บัญชีนักเรียน") : "ผู้เล่นทั่วไป (ไม่ได้เข้าสู่ระบบ)"}</span>
        </div>
      </div>
      <div className="menu-theme" role="group" aria-label="โหมดสี">
        {(["light", "dark", "system"] as const).map((p) => (
          <button key={p} className={pref === p ? "on" : ""} onClick={() => setThemePref(p)}>
            {p === "light" ? "สว่าง" : p === "dark" ? "มืด" : "ตามเครื่อง"}
          </button>
        ))}
      </div>
      <SoundToggle withLabel />
      <Link className="btn btn-ghost btn-sm" style={{ width: "100%" }} href="/account" onClick={() => { setMenu(false); setDrawer(false); }}>
        {me ? "ตั้งค่าบัญชี (ชื่อ / รหัสผ่าน)" : "เปลี่ยนชื่อผู้เล่น"}
      </Link>
      {sb && !loading && (me
        ? <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={logout}>ออกจากระบบ</button>
        : <Link className="btn btn-primary btn-sm" style={{ width: "100%" }} href="/login">เข้าสู่ระบบ / สมัครสมาชิก</Link>)}
    </>
  );

  return (
    <header className="topbar">
      <div className="wrap hdr">
        <Link className="brand" href="/" aria-label="QUIZVERSE หน้าแรก">
          <span className="brand-mark">Q</span>
          <span className="brand-text">
            <span className="brand-name">QUIZVERSE</span>
            <span className="brand-tag">Learn • Play • Challenge • Grow</span>
          </span>
        </Link>

        <nav className="nav hdr-nav" aria-label="เมนูหลัก">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={active(l.href) ? "on" : ""} aria-current={active(l.href) ? "page" : undefined}>{l.label}</Link>
          ))}
        </nav>

        <div className="hdr-right">
          <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"} title={dark ? "โหมดสว่าง" : "โหมดมืด"}>
            {dark ? <Sun /> : <Moon />}
          </button>

          <div className="user-menu" ref={menuRef}>
            <button className="user-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="true">
              <span className="avatar">{name.charAt(0).toUpperCase()}</span>
              <span className="user-name">{name}{me && <span className="user-role">{me.role === "teacher" ? "ครู" : "นักเรียน"}</span>}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {menu && <div className="menu-pop" role="menu">{userBlock}</div>}
          </div>

          <button className="icon-btn burger" onClick={() => setDrawer((v) => !v)} aria-expanded={drawer} aria-label="เปิดเมนู">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              {drawer ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {drawer && (
        <div className="drawer">
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: 6, paddingBlock: 12 }}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={"drawer-link" + (active(l.href) ? " on" : "")}>{l.label}</Link>
            ))}
            <div className="drawer-user">{userBlock}</div>
          </div>
        </div>
      )}
    </header>
  );
}
