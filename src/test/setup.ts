import "@testing-library/jest-dom";
import { vi } from "vitest";

// Tauri Store — used by lib/settings.ts
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: class {
    static async load() {
      return new this();
    }
    async get() {
      return null;
    }
    async set() {}
    async save() {}
  },
}));

// Tauri Dialog — used by wizard + KB picker
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

// Tauri FS — used by RAG
vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: vi.fn().mockResolvedValue([]),
  readTextFile: vi.fn().mockResolvedValue(""),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(false),
  BaseDirectory: { AppData: 1, Home: 2 },
}));

// Tauri core invoke — IPC bridge
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

// Tauri Shell — QVAC sidecar process
vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: { create: vi.fn(() => ({ spawn: vi.fn() })) },
}));

// Tauri Updater
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

// Tauri Process
vi.mock("@tauri-apps/plugin-process", () => ({
  exit: vi.fn(),
  relaunch: vi.fn(),
}));

// Tauri Opener
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
  revealItemInDir: vi.fn(),
}));
