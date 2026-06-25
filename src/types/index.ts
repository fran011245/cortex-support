/**
 * Shared TypeScript types for Cortex
 */

export type { CSSettings } from "@/lib/settings";
export type { ToneRules } from "@/lib/prompts";
export type { ChatMessage, QVACCompletionResult } from "@/lib/qvac";
export type { Message, ChatSession } from "@/stores/useAgentStore";
export type { CustomResponseTemplate } from "@/lib/responseTemplates";

export interface ToolAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: (input: string) => Promise<string>;
}

export interface SourceCitation {
  text: string;
  source: string;
  score?: number;
}
