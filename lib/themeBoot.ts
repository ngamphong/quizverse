/** Runs in <head> before first paint so the page never flashes the wrong theme (see lib/theme.ts). */
export const THEME_BOOT =
  'try{var t=localStorage.getItem("qv_theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}';
