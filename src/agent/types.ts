export type AgentStatus = 'thinking' | 'calling_tool' | 'responding' | 'error' | 'done';

export interface AgentEvent {
  type: 'status';
  status: AgentStatus;
  round: number;
  message?: string;
}

export interface AgentToolCallEvent {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
  round: number;
}

export interface AgentToolResultEvent {
  type: 'tool_result';
  name: string;
  success: boolean;
  round: number;
}

export interface AgentTokenEvent {
  type: 'token';
  text: string;
}

export interface AgentDoneEvent {
  type: 'done';
  content: string;
  rounds: number;
}

export interface AgentErrorEvent {
  type: 'error';
  message: string;
}

export type AgentStreamEvent =
  | AgentEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentTokenEvent
  | AgentDoneEvent
  | AgentErrorEvent;
