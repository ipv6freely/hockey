import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "./api.ts";
import type { ChatMessage, NhlPlayer } from "../../src/shared/index";

export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isLoading) return <div className="state-message">Loading…</div>;
  if (query.isError) return <div className="state-message error">Failed to load: {String(query.error)}</div>;
  if (!query.data) return null;
  return <>{children(query.data)}</>;
}

const MODEL_KEY = "openaiModel";

// A starting-point list, not an authoritative/exhaustive one — OpenAI ships
// new models often enough that this will go stale; it's autocomplete via
// <datalist>, not a locked <select>, so any exact model ID can still be
// typed directly. Check platform.openai.com/docs/models for what's current.
const MODEL_SUGGESTIONS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"];

export function useModelPreference() {
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_KEY) ?? "");
  const update = (next: string) => {
    setModel(next);
    if (next) localStorage.setItem(MODEL_KEY, next);
    else localStorage.removeItem(MODEL_KEY);
  };
  return [model, update] as const;
}

/** Free-text model override with autocomplete suggestions — empty means "use the server's configured default." */
export function ModelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="model-picker">
      <label htmlFor="model-picker-input">Model</label>
      <input
        id="model-picker-input"
        className="search-input"
        list="model-suggestions"
        placeholder="server default"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="model-suggestions">
        {MODEL_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}

/** Real NHL rosters (not fantasy data) from the NHL's own public API — fetched once per session, used to power PlayerAutocomplete below. */
export function useNhlPlayers() {
  return useQuery({ queryKey: ["nhlPlayers"], queryFn: api.nhlPlayers, staleTime: Infinity, retry: 1 });
}

/**
 * Typeahead over the NHL roster list: typing filters a dropdown of matches,
 * clicking one fires `onSelect` with the full player record (name +
 * position, unambiguous even for the rare same-named players since
 * selection is by object, not by re-parsing a string). Falls back to plain
 * free text with no special behavior if `players` is empty (still loading,
 * or the NHL API is unreachable) or nothing matches — a player not in this
 * season's roster snapshot (a very recent call-up) can still be typed by hand.
 */
export function PlayerAutocomplete({
  players,
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  players: NhlPlayer[];
  value: string;
  onChange: (v: string) => void;
  onSelect: (p: NhlPlayer) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const matches = query.length >= 2 ? players.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8) : [];

  return (
    <div className="player-autocomplete">
      <input
        className="search-input"
        placeholder={placeholder ?? "Player name"}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="player-autocomplete-list">
          {matches.map((p) => (
            <li
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
            >
              {p.name} <span className="note">{p.position} · {p.team}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Freeform Q&A box grounded in the currently selected league — reused on
 * the Yahoo Draft tab and the Manual Draft tab. Pass `manualContext` to
 * ground it in typed-in data instead of a Yahoo lookup, and `model` to
 * override the server's default OpenAI model for this conversation.
 */
export function ChatBox({
  leagueKey,
  manualContext,
  model,
}: {
  leagueKey: string | null;
  manualContext?: string;
  model?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [lastModel, setLastModel] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (question: string) => api.chat(leagueKey, question, messages, manualContext, model || undefined),
    onSuccess: (res, question) => {
      setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: res.reply }]);
      setLastModel(res.model);
    },
  });

  return (
    <div className="chat-box">
      <div className="chat-history">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message chat-${m.role}`}>
            <strong>{m.role === "user" ? "You" : "GPT"}:</strong> {m.content}
          </div>
        ))}
        {messages.length === 0 && <p className="note">Ask anything about this league, the draft, or a player.</p>}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || mutation.isPending) return;
          mutation.mutate(input.trim());
          setInput("");
        }}
      >
        <input
          className="search-input"
          placeholder="Ask about this league, the draft, a player…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "…" : "Ask"}
        </button>
      </form>
      {lastModel && <p className="note">Last reply from: {lastModel}</p>}
      {mutation.isError && <p className="state-message error">{String(mutation.error)}</p>}
    </div>
  );
}
