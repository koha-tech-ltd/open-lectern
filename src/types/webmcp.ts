/** Minimal WebMCP surface used by Lectern (document.modelContext / navigator.modelContext). */

export type JsonSchema = {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolExecuteResult =
  | string
  | {
      type?: 'text';
      text?: string;
      content?: Array<{ type: string; text: string }>;
      structuredContent?: unknown;
    };

export type ToolExecuteCallback = (
  args: Record<string, unknown>,
) => Promise<ToolExecuteResult> | ToolExecuteResult;

export interface ModelContextTool {
  name: string;
  description: string;
  title?: string;
  inputSchema?: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: ToolExecuteCallback;
}

export interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
}

export interface ModelContextApi {
  registerTool(
    tool: ModelContextTool,
    options?: ModelContextRegisterToolOptions,
  ): void | Promise<void>;
  unregisterTool?(name: string): void | Promise<void>;
  getTools?(): Promise<unknown[]> | unknown[];
  executeTool?(
    tool: unknown,
    input?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<unknown> | unknown;
}

declare global {
  interface Document {
    modelContext?: ModelContextApi;
  }

  interface Navigator {
    modelContext?: ModelContextApi;
    /** Chrome WebMCP testing helper behind chrome://flags/#enable-webmcp-testing. */
    modelContextTesting?: {
      executeTool?: (name: string, argsJson?: string) => Promise<unknown>;
      listTools?: () => Promise<unknown>;
    };
  }
}

export {};
