"use client";
import { useEffect, useState } from "react";

export default function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2800);
    };
    window.addEventListener("qv-toast", on);
    return () => { window.removeEventListener("qv-toast", on); clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return <div className="toast" role="status">{msg}</div>;
}
