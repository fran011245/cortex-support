/**
 * Thoth Local RAG Layer
 * Built on @qvac/sdk rag primitives + Tauri FS for reading user documents.
 * Phase 0: interfaces + basic helpers. Full ingestion pipeline in Phase 5.
 */

import { readTextFile, readDir, exists } from "@tauri-apps/plugin-fs";
import { rebuildKnowledgeBase as qvacRebuild, searchKnowledgeBase as qvacSearch } from "./qvac";
import { DEFAULT_EMBED_MODEL } from "./settings";

export interface KnowledgeDoc {
  path: string;
  title?: string;
  content: string;
  size: number;
}

export interface RagChunk {
  id: string;
  docPath: string;
  text: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface RagSearchHit {
  text: string;
  score: number;
  source: string; // path or title
  metadata?: any;
}

const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt", ".pdf"]; // PDF text extraction later via qvac or simple

/**
 * Recursively list supported documents in a folder.
 */
export async function listKnowledgeFiles(folderPath: string): Promise<string[]> {
  const files: string[] = [];
  if (!folderPath) return files;

  const folderExists = await exists(folderPath);
  if (!folderExists) return files;

  async function walk(dir: string) {
    try {
      const entries = await readDir(dir);
      for (const entry of entries) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory) {
          await walk(full);
        } else if (entry.isFile) {
          const lower = entry.name.toLowerCase();
          if (SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
            files.push(full);
          }
        }
      }
    } catch (e) {
      console.warn("[RAG] walk error for", dir, e);
    }
  }

  await walk(folderPath);
  return files;
}

/**
 * Read and return text content for a file. For .pdf we return placeholder (real extraction Phase 5 or via qvac ocr).
 */
export async function readDocument(path: string): Promise<KnowledgeDoc | null> {
  try {
    const lower = path.toLowerCase();
    if (lower.endsWith(".pdf")) {
      // Placeholder — in real impl use qvac ocr or pdf lib
      return {
        path,
        title: path.split("/").pop(),
        content: "[PDF content extraction pending — use Rebuild in Settings after Phase 5]",
        size: 0,
      };
    }
    const content = await readTextFile(path);
    return {
      path,
      title: path.split("/").pop()?.replace(/\.(md|markdown|txt)$/i, ""),
      content: content.trim(),
      size: content.length,
    };
  } catch (e) {
    console.error("[RAG] readDocument failed", path, e);
    return null;
  }
}

/**
 * Very simple chunker (Phase 0). Better semantic chunking later.
 */
export function chunkText(text: string, maxChars = 1200, overlap = 200): string[] {
  if (!text || text.length <= maxChars) return [text.trim()];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    let chunk = text.slice(start, end).trim();
    // try to cut at paragraph or sentence
    if (end < text.length) {
      const lastPara = chunk.lastIndexOf("\n\n");
      const lastSent = Math.max(chunk.lastIndexOf(". "), chunk.lastIndexOf("! "), chunk.lastIndexOf("? "));
      const cut = Math.max(lastPara, lastSent);
      if (cut > maxChars * 0.6) {
        chunk = chunk.slice(0, cut + 1).trim();
      }
    }
    if (chunk) chunks.push(chunk);
    start += chunk.length - overlap;
    if (start < 0) start = 0;
  }
  return chunks.filter(Boolean);
}

/**
 * Ingest a folder into a RAG workspace using QVAC.
 * Returns number of chunks created.
 * (Full version will persist embeddings via ragSaveEmbeddings)
 */
export async function ingestFolder(
  folderPath: string,
  _workspaceId = "thoth-cs-kb",
  onProgress?: (processed: number, total: number) => void,
): Promise<{ docCount: number; chunkCount: number }> {
  const filePaths = await listKnowledgeFiles(folderPath);
  let chunkCount = 0;
  let docCount = 0;

  for (let i = 0; i < filePaths.length; i++) {
    const doc = await readDocument(filePaths[i]);
    if (!doc || !doc.content) continue;

    const chunks = chunkText(doc.content);
    // For Phase 0 we just count; real path:
    // await qvacRag.ingest(...) or generateEmbeddings + ragSave
    chunkCount += chunks.length;
    docCount++;

    onProgress?.(i + 1, filePaths.length);
  }

  // Placeholder — in Phase 5 we will actually call qvac ragSaveEmbeddings / ragIngest
  return { docCount, chunkCount };
}

/**
 * Search the knowledge base. Returns hits with sources.
 */
export async function searchKnowledge(
  query: string,
  workspaceId = "thoth-cs-kb",
  topK = 5,
  embedModelId = DEFAULT_EMBED_MODEL,
): Promise<RagSearchHit[]> {
  try {
    const results = await qvacSearch(query, workspaceId, embedModelId, topK);
    return (results || []).slice(0, topK).map((r: any) => ({
      text: r.text || r.chunk || r.content || "",
      score: r.score ?? r.similarity ?? 0,
      source: r.source || r.path || r.metadata?.path || r.metadata?.source || "knowledge-base",
      metadata: r.metadata,
    }));
  } catch (e) {
    console.warn("[RAG] searchKnowledge failed (may need ingest first)", e);
    return [];
  }
}

export async function rebuildKnowledgeBase(
  folderPath: string,
  onProgress?: (p: number, t: number) => void,
  embedModelId = DEFAULT_EMBED_MODEL,
): Promise<{ docCount: number; chunkCount: number }> {
  const res = await qvacRebuild(folderPath, embedModelId);
  // onProgress not yet wired in host, but can be extended
  if (onProgress) onProgress(1, 1);
  return { docCount: res.docCount || 0, chunkCount: res.chunkCount || 0 };
}
