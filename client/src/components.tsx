import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, type UseQueryResult } from "@tanstack/react-query";
import { api } from "./api.ts";
import type { ChatMessage } from "../../src/shared/index";

export function QueryBoundary<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isLoading) return <div className="state-message">Loading…</div>;
  if (query.isError) return <div className="state-message error">Failed to load: {String(query.error)}</div>;
  if (!query.data) return null;
  return <>{children(query.data)}</>;
}

/** Freeform Q&A box grounded in the currently selected league — reused on the Draft tab and anywhere else ad hoc analysis is useful. */
export function ChatBox({ leagueKey }: { leagueKey: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const mutation = useMutation({
    mutationFn: (question: string) => api.chat(leagueKey, question, messages),
    onSuccess: (res, question) => {
      setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: res.reply }]);
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
      {mutation.isError && <p className="state-message error">{String(mutation.error)}</p>}
    </div>
  );
}
