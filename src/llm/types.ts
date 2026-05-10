import type { ToolDef } from '../tools/types.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCallDelta[];
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
}

export interface ToolCallDelta {
  id: string;
  index: number;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface CompletionRequest {
  model: string;
  messages: LLMMessage[];
  tools?: ToolDef[];
  tool_choice?: 'auto' | 'none' | 'required';
}

export interface CompletionResponse {
  content: string | null;
  toolCalls: ToolCallDelta[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface StreamingChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  reasoningContent?: string;
  toolCall?: ToolCallDelta;
}

export interface LLMClient {
  /** Non-streaming completion — returns full response after LLM finishes. */
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  /** Streaming completion — yields deltas as LLM generates tokens. */
  completeStream(req: CompletionRequest): AsyncGenerator<StreamingChunk>;
}

export type LLMProviderFactory = (config: Record<string, string>) => LLMClient;
