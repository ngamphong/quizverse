"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR code for a link, drawn as SVG in the browser (dark modules on white so any phone can scan it). */
export default function QrCode({ value, size = 220, label }: { value: string; size?: number; label?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1B1446", light: "#FFFFFF" } })
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => { if (alive) setSvg(""); });
    return () => { alive = false; };
  }, [value]);

  return (
    <div className="qr" style={{ width: size, height: size }} role="img" aria-label={label ?? `QR code ไปที่ ${value}`}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
  );
}
