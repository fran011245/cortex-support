import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { LoadingSplash } from "@/components/LoadingSplash";
import { ChatInterface } from "@/components/ChatInterface";
import { SettingsModal } from "@/components/SettingsModal";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Toaster } from "@/components/ui/sonner";
import { useAgentStore } from "@/stores/useAgentStore";
import { initQVAC } from "@/lib/qvac";
import { ToolsView } from "@/components/ToolsView";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { init, isSettingsOpen, settings, isOnboardingOpen, setOnboardingOpen } = useAgentStore();

  useEffect(() => {
    // Bootstrap store (sessions + persisted settings)
    init().catch(console.error);

    // Start the local QVAC engine (non-blocking for Phase 0)
    initQVAC()
      .then(() => {
        // success is silent in UI for now
      })
      .catch((e) => {
        console.warn("[Cortex] QVAC provider not ready yet (expected in early dev):", e);
        // Don't block the UI — Phase 1 will surface a nice status
      });

    // Keyboard shortcuts
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === ",") {
        e.preventDefault();
        useAgentStore.getState().setSettingsOpen(!isSettingsOpen);
      }
      if (isMeta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useAgentStore.getState().newSession();
      }
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Focus chat input if in chat mode
        const input = document.querySelector("textarea") as HTMLTextAreaElement;
        input?.focus();
      }
      if (isMeta && e.key.toLowerCase() === "r" && useAgentStore.getState().settings?.ragFolderPath) {
        e.preventDefault();
        useAgentStore.getState().setSettingsOpen(true);
        // User can trigger rebuild from settings
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [init, isSettingsOpen]);

  // First-run wizard trigger (after settings are loaded)
  // Only auto-open if the user has never completed onboarding
  useEffect(() => {
    if (settings && !settings.hasCompletedOnboarding && !isOnboardingOpen) {
      // Small delay so the main UI paints first
      const t = setTimeout(() => {
        setOnboardingOpen(true);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [settings, isOnboardingOpen, setOnboardingOpen]);

  return (
    <>
      {showSplash && <LoadingSplash onDone={() => setShowSplash(false)} />}
      <div
        className="flex h-screen w-screen overflow-hidden bg-[#0A0F1C] text-foreground antialiased"
        data-tauri-drag-region
      >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {useAgentStore((s) => s.activeTool) === "chat" ? (
          <ChatInterface />
        ) : (
          <ToolsView />
        )}
      </div>

      <SettingsModal />
      <OnboardingWizard
        open={isOnboardingOpen}
        onOpenChange={setOnboardingOpen}
      />

      <Toaster
        position="top-center"
        closeButton
        richColors
        className="toaster"
        toastOptions={{
          classNames: {
            toast: "glass border-[#1E293B] bg-[#121827] text-foreground",
          },
        }}
      />
    </div>
    </>
  );
}

export default App;
