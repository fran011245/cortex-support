/**
 * Cortex Global Store (Zustand)
 * Manages chat sessions, agent state, loading, settings sync.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { loadSettings, updateSettings as libUpdateSettings, type CSSettings } from "@/lib/settings";
import { Store } from "@tauri-apps/plugin-store";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  sources?: Array<{ text: string; source: string; score?: number }>;
  timestamp: string;
  isStreaming?: boolean;
  // Usage / consumption stats from the model (prompt/completion tokens, timings, etc.)
  // Populated from streamCompletion result.stats for finished assistant turns.
  // Kept as any for flexibility (shape comes from the stable QVAC host/llama.cpp).
  stats?: any;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface AgentState {
  // Current chat
  currentSession: ChatSession | null;
  sessions: ChatSession[];

  // Agent runtime
  isLoading: boolean;
  isStreaming: boolean;
  currentModelId: string;
  abortController: AbortController | null;

  // Settings (synced from disk)
  settings: CSSettings | null;

  // UI
  isSettingsOpen: boolean;
  activeTool: "chat" | "grammar" | "translate" | "templates" | null;

  // Actions
  init: () => Promise<void>;
  newSession: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  appendMessage: (msg: Omit<Message, "id" | "timestamp">) => void;
  updateLastMessage: (patch: Partial<Message>) => void;
  removeLastAssistantMessage: () => string | null;
  setStreaming: (streaming: boolean) => void;
  setLoading: (loading: boolean) => void;
  setModelId: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveTool: (tool: AgentState["activeTool"]) => void;
  updateSettings: (partial: Partial<CSSettings>) => Promise<void>;
  abortCurrent: () => void;
  clearCurrentChat: () => void;
}

const createNewSession = (): ChatSession => ({
  id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
  title: "New conversation",
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Tauri Store persistence for sessions.
// Survives app reinstalls / app data clear (unlike localStorage).
// Uses the same @tauri-apps/plugin-store as settings ("cortex-sessions.json").
//
// Graceful degradation:
// - Falls back to localStorage on any error (dev, first render before plugin ready, etc.)
// - One-time migration from localStorage on first successful read.
//
// Note on async storage + Zustand persist:
// Rehydration is async. In practice the UI shows default empty state for one frame
// on cold start; the persisted sessions appear immediately after. This is acceptable
// for a desktop app and matches how settings are loaded.
let _sessionsStore: Store | null = null;

async function getSessionsStore(): Promise<Store> {
  if (!_sessionsStore) {
    _sessionsStore = await Store.load("cortex-sessions.json", {
      defaults: {},
      autoSave: true,
    });
  }
  return _sessionsStore;
}

const tauriStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const store = await getSessionsStore();
      const value = await store.get<string>(name);
      if (value != null) {
        return value;
      }

      // One-time migration from localStorage (only if we have legacy data)
      const legacy = localStorage.getItem(name);
      if (legacy) {
        await store.set(name, legacy);
        await store.save();
        localStorage.removeItem(name);
        return legacy;
      }
      return null;
    } catch (err) {
      // Never block the app on storage issues
      console.warn("[Cortex] tauriStorage.getItem fallback to localStorage", err);
      return localStorage.getItem(name);
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const store = await getSessionsStore();
      await store.set(name, value);
      await store.save();
    } catch (err) {
      console.warn("[Cortex] tauriStorage.setItem fallback to localStorage", err);
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const store = await getSessionsStore();
      await store.delete(name);
      await store.save();
    } catch (err) {
      console.warn("[Cortex] tauriStorage.removeItem fallback", err);
      localStorage.removeItem(name);
    }
  },
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessions: [],
      isLoading: false,
      isStreaming: false,
      currentModelId: "",
      abortController: null,
      settings: null,
      isSettingsOpen: false,
      activeTool: "chat",

      init: async () => {
        const settings = await loadSettings();
        set({ settings, currentModelId: "" });

        const { sessions, currentSession } = get();
        if (!currentSession && sessions.length === 0) {
          const sess = createNewSession();
          set({ currentSession: sess, sessions: [sess] });
        } else if (!currentSession && sessions.length > 0) {
          set({ currentSession: sessions[0] });
        }
      },

      newSession: () => {
        const sess = createNewSession();
        set((state) => ({
          currentSession: sess,
          sessions: [sess, ...state.sessions],
          activeTool: "chat",
        }));
      },

      loadSession: (id) => {
        const sess = get().sessions.find((s) => s.id === id);
        if (sess) set({ currentSession: sess, activeTool: "chat" });
      },

      deleteSession: (id) => {
        set((state) => {
          const remaining = state.sessions.filter((s) => s.id !== id);
          const newCurrent =
            state.currentSession?.id === id
              ? remaining[0] || createNewSession()
              : state.currentSession;

          if (newCurrent && !remaining.find((s) => s.id === newCurrent.id)) {
            remaining.unshift(newCurrent);
          }

          return { sessions: remaining, currentSession: newCurrent };
        });
      },

      renameSession: (id, newTitle) => {
        const title = newTitle.trim() || "New conversation";
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, title, updatedAt: new Date().toISOString() } : s,
          ),
          currentSession:
            state.currentSession?.id === id
              ? { ...state.currentSession, title }
              : state.currentSession,
        }));
      },

      appendMessage: (msg) => {
        const now = new Date().toISOString();
        const fullMsg: Message = {
          ...msg,
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          timestamp: now,
        };

        set((state) => {
          if (!state.currentSession) return state;

          const updated: ChatSession = {
            ...state.currentSession,
            messages: [...state.currentSession.messages, fullMsg],
            updatedAt: now,
            title:
              state.currentSession.title === "New conversation" && msg.role === "user"
                ? msg.content.slice(0, 48) + (msg.content.length > 48 ? "…" : "")
                : state.currentSession.title,
          };

          return {
            currentSession: updated,
            sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
          };
        });
      },

      updateLastMessage: (patch) => {
        set((state) => {
          if (!state.currentSession) return state;

          const msgs = [...state.currentSession.messages];
          if (msgs.length === 0) return state;

          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...patch };

          const updated: ChatSession = {
            ...state.currentSession,
            messages: msgs,
            updatedAt: new Date().toISOString(),
          };

          return {
            currentSession: updated,
            sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
          };
        });
      },

      // Removes the last assistant message and returns the preceding user message text.
      // Used by the Regenerate button to re-run the same user turn.
      removeLastAssistantMessage: () => {
        let precedingUserText: string | null = null;

        set((state) => {
          if (!state.currentSession) return state;
          const msgs = [...state.currentSession.messages];

          let lastAssistantIdx = -1;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") { lastAssistantIdx = i; break; }
          }
          if (lastAssistantIdx === -1) return state;

          for (let i = lastAssistantIdx - 1; i >= 0; i--) {
            if (msgs[i].role === "user") { precedingUserText = msgs[i].content; break; }
          }

          const trimmed = msgs.slice(0, lastAssistantIdx);
          const updated = { ...state.currentSession, messages: trimmed, updatedAt: new Date().toISOString() };
          return {
            currentSession: updated,
            sessions: state.sessions.map((s) => (s.id === updated.id ? updated : s)),
          };
        });

        return precedingUserText;
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setLoading: (loading) => set({ isLoading: loading }),

      setModelId: (id) => set({ currentModelId: id }),

      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      setActiveTool: (tool) => set({ activeTool: tool }),

      updateSettings: async (partial) => {
        const next = await libUpdateSettings(partial);
        set({ settings: next });
      },

      abortCurrent: () => {
        const ac = get().abortController;
        if (ac) {
          ac.abort();
          set({ abortController: null, isStreaming: false });
        }
      },

      clearCurrentChat: () => {
        const { currentSession } = get();
        if (!currentSession) return;

        const cleared: ChatSession = {
          ...currentSession,
          messages: [],
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          currentSession: cleared,
          sessions: state.sessions.map((s) => (s.id === cleared.id ? cleared : s)),
        }));
      },
    }),
    {
      name: "cortex-agent-store",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSession: state.currentSession,
        // currentModelId is a per-process runtime handle — never persist it
      }),
    },
  ),
);
