"use client";
import { useEffect } from "react";

const MSG = "กำลังเล่นอยู่ ถ้าออกตอนนี้ข้อที่เหลือจะไม่ถูกนับ ต้องการออกจากเกมจริงไหม?";

/**
 * While a game is running: hide the site navigation (CSS on html[data-ingame]),
 * ask before closing/reloading the tab, and catch the browser/phone back button.
 */
export function useGameLock(active: boolean, message = MSG) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    html.dataset.ingame = "1";

    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);

    // back button: keep a guard entry on top of the history; pressing back lands on the page
    // itself again, and we ask. (Next.js keeps its router state on entries pushed this way.)
    let leaving = false;
    window.history.pushState(window.history.state, "", window.location.href);
    const onPopState = () => {
      if (leaving) return;
      if (window.confirm(message)) {
        leaving = true;
        cleanup();
        window.history.back();
      } else {
        window.history.pushState(window.history.state, "", window.location.href);
      }
    };
    window.addEventListener("popstate", onPopState);

    function cleanup() {
      delete html.dataset.ingame;
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    }
    return cleanup;
  }, [active, message]);
}
