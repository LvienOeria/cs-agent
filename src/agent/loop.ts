import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from '../observability/logger.js';
import { RequestTracker } from '../observability/tracker.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { getAllToolDefs, executeTool } from '../tools/registry.js';
import { executeWithTimeout } from './tool-timeout.js';
import { sanitizeToolResult } from '../middleware/guardrails/output.js';
import {
  llmRequestDuration,
  llmTokenUsage,
  toolExecutionDuration,
  agentRounds,
  requestErrors,
} from '../observability/metrics.js';
import type { AgentStreamEvent } from './types.js';
import type { LLMClient, ToolCallDelta } from '../llm/types.js';

const MAX_ROUNDS = 5;
const TOOL_TIMEOUT_MS = 30_000;

export async function* runAgentLoop(
  client: LLMClient,
  model: string,
  provider: string,
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
    const roundStart = Date.now();
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    const toolCallMap = new Map<string, ToolCallDelta>();
    let hasError = false;

    // Stream LLM response
    yield { type: 'status', status: 'thinking', round };

    try {
      for await (const chunk of client.completeStream({
        model,
        messages: messages as unknown as import('../llm/types.js').LLMMessage[],
        tools,
        tool_choice: 'auto',
      })) {
        if (chunk.type === 'content') {
          if (chunk.content) {
            accumulatedContent += chunk.content;
            yield { type: 'token', text: chunk.content };
          }
          if (chunk.reasoningContent) {
            accumulatedReasoning += chunk.reasoningContent;
          }
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          const tc = chunk.toolCall;
          // Use index as merge key — DeepSeek streams args without id/name
          const key = String(tc.index);
          const existing = toolCallMap.get(key);
          if (existing) {
            existing.function.arguments += tc.function.arguments;
            if (tc.id) existing.id = tc.id;
            if (tc.function.name) existing.function.name = tc.function.name;
          } else {
            toolCallMap.set(key, {
              id: tc.id,
              index: tc.index,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            });
          }
        }
        // 'done' signals stream end, ignore
      }

      llmRequestDuration.observe({ provider, model }, Date.now() - roundStart);
    } catch (err) {
      llmRequestDuration.observe({ provider, model }, Date.now() - roundStart);
      requestErrors.inc({ type: 'llm_error' });
      const message = err instanceof Error ? err.message : 'LLM call failed';
      logger.error({ err, round }, 'LLM API error');
      yield { type: 'error', message: `AI 服务暂时不可用：${message}` };
      return;
    }

    const toolCalls = [...toolCallMap.values()];

    const promptTokens = round === 1 ? 500 : 300; // rough estimate for streaming
    const completionTokens = accumulatedContent.length;
    llmTokenUsage.inc({ provider, model, type: 'prompt' }, promptTokens);
    llmTokenUsage.inc({ provider, model, type: 'completion' }, completionTokens);

    tracker.addRound({
      round,
      promptTokens,
      completionTokens,
      durationMs: Date.now() - roundStart,
      toolCalls: [],
    });

    // If LLM returned tool calls
    if (toolCalls.length > 0) {
      const functionCalls = toolCalls.filter(
        (tc) => tc.type === 'function' && !!tc.function?.name
      );

      if (functionCalls.length === 0) {
        requestErrors.inc({ type: 'unsupported_tool' });
        yield { type: 'error', message: 'AI 尝试使用不支持的工具类型' };
        return;
      }

      messages.push({
        role: 'assistant',
        content: accumulatedContent || null,
        ...(accumulatedReasoning ? { reasoning_content: accumulatedReasoning } : {}),
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
        const content = await executeWithTimeout(
          toolName,
          () => executeTool(tc.id, toolName, args).then((r) => r.content),
          TOOL_TIMEOUT_MS
        );
        const toolDuration = Date.now() - toolStart;
        toolExecutionDuration.observe({ tool_name: toolName }, toolDuration);

        const parsed = JSON.parse(content);
        const result = {
          tool_call_id: tc.id,
          role: 'tool' as const,
          content: sanitizeToolResult(content),
        };

        const lastRound = tracker.lastRound;
        if (lastRound) {
          lastRound.toolCalls.push({
            toolName,
            durationMs: toolDuration,
            success: !parsed.error,
            errorMessage: parsed.error ? parsed.message : undefined,
          });
        }

        yield {
          type: 'tool_result',
          name: toolName,
          success: !parsed.error,
          round,
        };

        messages.push(result);
      }

      continue;
    }

    // No tool calls — text response
    agentRounds.observe(round);
    yield {
      type: 'done',
      content: accumulatedContent || '抱歉，我暂时无法回答这个问题。',
      rounds: round,
    };
    return;
  }

  requestErrors.inc({ type: 'max_rounds' });
  agentRounds.observe(MAX_ROUNDS);
  yield {
    type: 'error',
    message: '处理步骤过多，未能完成您的请求。请尝试简化问题，或为您转接人工客服。',
  };
}
