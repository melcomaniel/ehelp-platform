"use client";

import { useState } from "react";

import { nestFetch } from "@/lib/api/nest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Turn = { fromUser: boolean; text: string };

/**
 * Interim eGov AI chat (Nest proxy). Uses live API when EGOV_AI_ACCESS_CODE
 * is set on the backend; otherwise returns mock answers.
 */
export function EgovAiChatPanel() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([
    {
      fromUser: false,
      text: "I help with EHelp navigation, program details & coverage, dates, disbursement queue slots/locations, and application status. I cannot create applications or book slots, and I will not discuss unrelated topics.",
    },
  ]);

  async function send() {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setTurns((prev) => [...prev, { fromUser: true, text }]);
    setPrompt("");
    try {
      const res = await nestFetch<{
        data: string;
        session_id: string;
        mode: string;
      }>("/integrations/egov-ai/assistant", {
        method: "POST",
        body: { prompt: text, category: "PH" },
      });
      setMode(res.mode);
      setTurns((prev) => [
        ...prev,
        { fromUser: false, text: res.data || "(empty reply)" },
      ]);
    } catch (e) {
      setTurns((prev) => [
        ...prev,
        {
          fromUser: false,
          text: e instanceof Error ? e.message : String(e),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex max-h-[28rem] flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">eGov AI Assistant</p>
        {mode ? (
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {mode}
          </span>
        ) : null}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {turns.map((t, i) => (
          <div
            key={`${i}-${t.text.slice(0, 12)}`}
            className={
              t.fromUser
                ? "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm"
                : "mr-8 rounded-lg bg-muted/50 px-3 py-2 text-sm"
            }
          >
            {t.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t p-3">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask a question…"
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <Button type="button" disabled={loading} onClick={() => void send()}>
          {loading ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
