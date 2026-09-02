/**
 * Minimal WebMCP polyfill for local / Cursor-browser demos.
 * Skipped automatically when native document.modelContext or navigator.modelContext exists.
 * Judges should use ChatGPT’s browser or Chrome with #enable-webmcp-testing (native API).
 */

import type { ModelContextApi, ModelContextTool, ToolExecuteResult } from '@/types/webmcp';

type StoredTool = ModelContextTool & { signal?: AbortSignal };

declare global {
  interface Window {
    __lecternWebMcpDemo?: {
      listTools: () => Promise<Array<{ name: string; description: string }>>;
      executeTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
      isPolyfill: boolean;
    };
  }
}

function installPolyfill(): void {
  if (typeof document === 'undefined') return;
  if (document.modelContext || navigator.modelContext) return;

  const tools = new Map<string, StoredTool>();

  const api: ModelContextApi = {
    async registerTool(tool, options) {
      if (!tool?.name || !tool.description || typeof tool.execute !== 'function') {
        throw new Error('Invalid WebMCP tool descriptor');
      }
      if (tools.has(tool.name)) {
        tools.delete(tool.name);
      }
      const stored: StoredTool = { ...tool, signal: options?.signal };
      tools.set(tool.name, stored);
      options?.signal?.addEventListener(
        'abort',
        () => {
          tools.delete(tool.name);
        },
        { once: true },
      );
    },
    async unregisterTool(name) {
      tools.delete(name);
    },
    async getTools() {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },
  };

  Object.defineProperty(document, 'modelContext', {
    value: api,
    configurable: true,
  });

  window.__lecternWebMcpDemo = {
    isPolyfill: true,
    async listTools() {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
      }));
    },
    async executeTool(name, args = {}) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool not registered: ${name}`);
      const result: ToolExecuteResult = await tool.execute(args);
      return result;
    },
  };

  console.info('[Lectern] WebMCP polyfill installed for local demo (native API not detected).');
}

installPolyfill();
