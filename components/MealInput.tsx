"use client";
import { useEffect, useRef, useState } from "react";
import { analyzePhoto, analyzeText, type Analysis } from "@/lib/analyzeClient";
import { preloadYolo } from "@/lib/yolo";

export type InputSource = "photo" | "text" | "voice";

/** Three ways in: photo, typing, or speaking. Calls onResult with the dishes found. */
export default function MealInput({ onResult, compact = false, hint }: { onResult: (a: Analysis, source: InputSource) => void; compact?: boolean; hint?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const usedVoice = useRef(false);
  const rec = useRef<any>(null);

  useEffect(() => {
    preloadYolo();
    setCanSpeak(typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  async function run(fn: () => Promise<Analysis>, source: InputSource) {
    setErr(null);
    try {
      const a = await fn();
      if (a.photo) setPhoto(a.photo);
      onResult(a, source);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  function toggleMic() {
    if (listening) { rec.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-IN"; // understands Indian English and most Hinglish dish names
    r.interimResults = true;
    r.continuous = false;
    const base = text ? text.trim() + ", " : "";
    r.onresult = (e: any) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText(base + s);
    };
    r.onerror = (e: any) => { setErr(e.error === "not-allowed" ? "Microphone permission was blocked. Allow it in your browser settings, or type instead." : `Voice input stopped (${e.error}).`); setListening(false); };
    r.onend = () => setListening(false);
    rec.current = r;
    usedVoice.current = true;
    setListening(true);
    r.start();
  }

  return (
    <div className="stack">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) run(() => analyzePhoto(f, setBusy), "photo"); e.target.value = ""; }} />
      {photo ? (
        <img className="preview" src={photo} alt="Your meal" onClick={() => fileRef.current?.click()} />
      ) : (
        <div className={"drop" + (compact ? " compact" : "")} onClick={() => fileRef.current?.click()}>
          <div className="big"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg></div>
          <b>Take or upload a photo of your plate</b>
          {!compact && <span className="muted tiny">{hint ?? "Thalis, dosa, roti-sabzi, pizza… we list each dish with its portion."}</span>}
        </div>
      )}

      <div className="or"><span>or say / type it</span></div>
      <form className="say" onSubmit={(e) => { e.preventDefault(); if (text.trim()) run(() => analyzeText(text, setBusy), usedVoice.current ? "voice" : "text"); }}>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 2 roti, 1 katori dal, half plate rice, chai"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <div className="row" style={{ gap: 8 }}>
          {canSpeak && (
            <button type="button" className={"btn ghost small mic" + (listening ? " on" : "")} onClick={toggleMic} aria-pressed={listening}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              {listening ? "Listening… tap to stop" : "Speak"}
            </button>
          )}
          <button className="btn small" disabled={!text.trim() || !!busy}>Find dishes</button>
        </div>
      </form>
      {busy && <p className="muted" style={{ margin: 0 }}>{busy}</p>}
      {err && <div className="card error">{err}</div>}
    </div>
  );
}
