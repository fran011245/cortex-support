/**
 * Thoth Global Store (Zustand)
 * Manages chat sessions, agent state, loading, settings sync.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { loadSettings, saveSettings, updateSettings as libUpdateSettings, type CSSettings } from "@/lib/settings";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  sources?: Array<{ text: string; source: string; score?: number }>;
  timestamp: string;
  isStreaming?: boolean;
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
  appendMessage: (msg: Omit<Message, "id" | "timestamp">) => void;
  updateLastMessage: (patch: Partial<Message>) => void;
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
        set({ settings, currentModelId: settings.defaultModelId || "" });

        // Bootstrap first session if none
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
        }));
      },

      loadSession: (id) => {
        const sess = get().sessions.find((s) => s.id === id);
        if (sess) set({ currentSession: sess });
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

          return {
            sessions: remaining,
            currentSession: newCurrent,
          };
        });
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
                ? msg.content.slice(0, 48) + (msg.content.length > 48 ? "..." : "")
                : state.currentSession.title,
          };

          const sessions = state.sessions.map((s) =>
            s.id === updated.id ? updated : s,
          );

          return {
            currentSession: updated,
            sessions,
          };
        });
      },

      updateLastMessage: (patch) => {
        set((state) => {
          if (!state.currentSession) return state;

          const msgs = [...state.currentSession.messages];
          if (msgs.length === 0) return state;

          const last = { ...msgs[msgs.length - 1], ...patch };
          msgs[msgs.length - 1] = last;

          const updated: ChatSession = {
            ...state.currentSession,
            messages: msgs,
            updatedAt: new Date().toISOString(),
          };

          const sessions = state.sessions.map((s) =>
            s.id === updated.id ? updated : s,
          );

          return { currentSession: updated, sessions };
        });
      },

      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setLoading: (loading) => set({ isLoading: loading }),

      setModelId: (id) => {
        set({ currentModelId: id });
        // also persist to settings if desired
        const { settings } = get();
        if (settings) {
          saveSettings({ ...settings, defaultModelId: id }).catch(console.error);
        }
      },

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
      name: "thoth-agent-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        currentSession: state.currentSession,
        currentModelId: state.currentModelId,
      }),
    },
  ),
);
