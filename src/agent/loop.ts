import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions/completions';
import { config } from '../config.js';
import { logger } from '../observability/logger.js';
import { RequestTracker } from '../observability/tracker.js';
import { SYSTEM_PROMPT } from './prompts.js';
import { getAllToolDefs, executeTool } from '../tools/registry.js';
import type { AgentStreamEvent } from './types.js';

const MAX_ROUNDS = 5;

export async function* runAgentLoop(
  client: OpenAI,
  userMessage: string,
  history: ChatCompletionMessageParam[],
  tracker: RequestTracker
): AsyncGenerator<AgentStreamEvent> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const tools = getAllToolDefs().map((def) => ({
    type: def.type as 'function',
    function: def.function,
  }));

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Step 1: Signal "thinking"
    yield { type: 'status', status: 'thinking', round };

    // Step 2: Call LLM
    const roundStart = Date.now();
    let response;
    try {
      response = await client.chat.completions.create({
        model: config.DEEPSEEK_MODEL,
        messages,
        tools,
        tool_choice: 'auto',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LLM call failed';
      logger.error({ err, round }, 'LLM API error');
      yield { type: 'error', message: `AI 服务暂时不可用：${message}` };
      return;
    }

    const choice = response.choices[0];
    if (!choice) {
      yield { type: 'error', message: 'AI 返回了空响应，请重试' };
      return;
    }

    const { message } = choice;

    // Step 3: Record token usage
    const usage = response.usage;
    tracker.addRound({
      round,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      durationMs: Date.now() - roundStart,
      toolCalls: [],
    });

    // Step 4: If LLM has tool calls, execute them
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Only handle function-type tool calls (ignore custom tools)
      const functionCalls = message.tool_calls.filter(
        (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === 'function'
      );

      if (functionCalls.length === 0) {
        yield { type: 'error', message: 'AI 尝试使用不支持的工具类型' };
        return;
      }

      // Add assistant message (with tool calls) to history
      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: functionCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });

      // Execute each tool
      for (const tc of functionCalls) {
        const toolName = tc.function.name;
        let args: Record<string, unknown> = {};

        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          logger.warn({ toolName, raw: tc.function.arguments }, 'Failed to parse tool arguments');
        }

        yield {
          type: 'tool_call',
          name: toolName,
          args,
          round,
        };

        const toolStart = Date.now();
        const result = executeTool(tc.id, toolName, args);
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

    // Step 5: No tool calls — LLM gave a text response
    yield { type: 'status', status: 'responding', round };
    yield {
      type: 'done',
      content: message.content ?? '抱歉，我暂时无法回答这个问题。',
      rounds: round,
    };
    return;
  }

  // Step 6: Max rounds exceeded
  yield {
    type: 'error',
    message: '处理步骤过多，未能完成您的请求。请尝试简化问题，或为您转接人工客服。',
  };
}
