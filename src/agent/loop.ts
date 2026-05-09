import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions/completions';
import { logger } from '../observability/logger.js';
import { RequestTracker } from '../observability/tracker.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { getAllToolDefs, executeTool } from '../tools/registry.js';
import type { AgentStreamEvent } from './types.js';
import type { LLMClient } from '../llm/types.js';

const MAX_ROUNDS = 5;

export async function* runAgentLoop(
  client: LLMClient,
  model: string,
  userMessage: string,
  history: ChatCompletionMessageParam[],
  tracker: RequestTracker
): AsyncGenerator<AgentStreamEvent> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const tools = getAllToolDefs();

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    yield { type: 'status', status: 'thinking', round };

    const roundStart = Date.now();
    let response;
    try {
      response = await client.complete({
        model,
        messages: messages as unknown as import('../llm/types.js').LLMMessage[],
        tools,
        tool_choice: 'auto',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LLM call failed';
      logger.error({ err, round }, 'LLM API error');
      yield { type: 'error', message: `AI 服务暂时不可用：${message}` };
      return;
    }

    tracker.addRound({
      round,
      promptTokens: response.usage?.promptTokens ?? 0,
      completionTokens: response.usage?.completionTokens ?? 0,
      durationMs: Date.now() - roundStart,
      toolCalls: [],
    });

    // If LLM has tool calls, execute them
    if (response.toolCalls.length > 0) {
      const functionCalls = response.toolCalls.filter(
        (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === 'function'
      );

      if (functionCalls.length === 0) {
        yield { type: 'error', message: 'AI 尝试使用不支持的工具类型' };
        return;
      }

      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: functionCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      for (const tc of functionCalls) {
        const toolName = tc.function.name;
        let args: Record<string, unknown> = {};

        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          logger.warn({ toolName, raw: tc.function.arguments }, 'Failed to parse tool arguments');
        }

        yield { type: 'tool_call', name: toolName, args, round };

        const toolStart = Date.now();
        const result = await executeTool(tc.id, toolName, args);
        const toolDuration = Date.now() - toolStart;

        const lastRound = tracker.lastRound;
        if (lastRound) {
          lastRound.toolCalls.push({
            toolName,
            durationMs: toolDuration,
            success: !JSON.parse(result.content).error,
            errorMessage: JSON.parse(result.content).error
              ? JSON.parse(result.content).message
              : undefined,
          });
        }

        yield {
          type: 'tool_result',
          name: toolName,
          success: !JSON.parse(result.content).error,
          round,
        };

        messages.push(result);
      }

      continue;
    }

    // No tool calls — text response
    yield { type: 'status', status: 'responding', round };
    yield {
      type: 'done',
      content: response.content ?? '抱歉，我暂时无法回答这个问题。',
      rounds: round,
    };
    return;
  }

  // Max rounds exceeded
  yield {
    type: 'error',
    message: '处理步骤过多，未能完成您的请求。请尝试简化问题，或为您转接人工客服。',
  };
}
