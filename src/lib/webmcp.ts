import type { ModelContextApi, ModelContextTool, ToolExecuteResult } from '@/types/webmcp';

export function getModelContext(): ModelContextApi | null {
  if (typeof document !== 'undefined' && document.modelContext) {
    return document.modelContext;
  }
  if (typeof navigator !== 'undefined' && navigator.modelContext) {
    return navigator.modelContext;
  }
  return null;
}

export function isWebMcpAvailable(): boolean {
  return getModelContext() !== null;
}

export function toolText(payload: unknown): ToolExecuteResult {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return {
    type: 'text',
    text,
    content: [{ type: 'text', text }],
    structuredContent: typeof payload === 'string' ? { text: payload } : payload,
  };
}

export async function registerTools(
  tools: ModelContextTool[],
  signal?: AbortSignal,
): Promise<{ ok: boolean; registered: string[]; error?: string }> {
  const ctx = getModelContext();
  if (!ctx) {
    return { ok: false, registered: [], error: 'WebMCP is not available in this browser.' };
  }

  const registered: string[] = [];
  try {
    for (const tool of tools) {
      if (ctx.unregisterTool) {
        try {
          const cleanup = ctx.unregisterTool(tool.name);
          if (cleanup && typeof (cleanup as Promise<void>).then === 'function') {
            await cleanup;
          }
        } catch {
          // Ignore missing tools during replace registration.
        }
      }
      const result = ctx.registerTool(tool, signal ? { signal } : undefined);
      if (result && typeof (result as Promise<void>).then === 'function') {
        await result;
      }
      registered.push(tool.name);
    }
    return { ok: true, registered };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, registered, error: message };
  }
}

export async function unregisterTools(names: string[]): Promise<void> {
  const ctx = getModelContext();
  if (!ctx?.unregisterTool) return;
  for (const name of names) {
    try {
      const result = ctx.unregisterTool(name);
      if (result && typeof (result as Promise<void>).then === 'function') {
        await result;
      }
    } catch {
      // Best-effort cleanup when switching modes.
    }
  }
}
