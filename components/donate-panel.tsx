"use client";

import { useState } from "react";

const PRESETS = [2000, 5000, 10000, 20000, 50000] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DonatePanel({ open, onClose }: Props) {
  const [amount, setAmount] = useState<number>(5000);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (!open) return null;

  const selected =
    custom.trim().length > 0 ? Math.floor(Number(custom) || 0) : amount;

  const pay = async () => {
    setNote("");
    if (selected < 1 || selected > 1_000_000) {
      setNote("Дүн 1₮–1,000,000₮ байх ёстой");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMnt: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setNote(data.error || "Төлбөр үүсгэж чадсангүй");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setNote("Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="donate-pop" role="dialog" aria-label="Дэмжих">
      <div className="donate-hero">
        <span className="donate-hero-mark" aria-hidden>
          ♥
        </span>
        <div className="donate-hero-copy">
          <small>SUPPORT</small>
          <strong>Дэмжих</strong>
          <p>Дуугаа Таа үнэгүй. Дуртай бол жижиг дэмжлэг үзүүлээрэй.</p>
        </div>
        <button
          type="button"
          className="board-close"
          onClick={onClose}
          aria-label="Хаах"
        >
          ×
        </button>
      </div>
      <div className="donate-presets">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            className={`donate-chip${amount === n && !custom ? " on" : ""}`}
            disabled={busy}
            onClick={() => {
              setAmount(n);
              setCustom("");
            }}
          >
            {n.toLocaleString("mn-MN")}₮
          </button>
        ))}
      </div>
      <input
        className="gm-input donate-custom"
        inputMode="numeric"
        placeholder="Өөр дүн (₮)"
        value={custom}
        disabled={busy}
        onChange={(e) =>
          setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 7))
        }
      />
      {note && <p className="board-note">{note}</p>}
      <button
        type="button"
        className="go donate-go"
        disabled={busy}
        onClick={() => void pay()}
      >
        {busy
          ? "Үүсгэж байна…"
          : `♥  ${selected.toLocaleString("mn-MN")}₮ дэмжих`}
      </button>
      <p className="donate-secure">Wire · QPay · Аюулгүй төлбөр</p>
    </div>
  );
}
