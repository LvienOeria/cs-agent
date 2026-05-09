import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProviderFactory,
  LLMClient,
  CompletionRequest,
  CompletionResponse,
  ToolCallDelta,
  StreamingChunk,
} from '../types.js';

/**
 * Anthropic (Claude) adapter.
 *
 * Key differences from OpenAI-compatible API:
 * - System prompt is a top-level parameter, not a message role
 * - Tool calls use `tool_use` / `tool_result` content blocks
 * - Messages with role="tool" become user messages with tool_result blocks
 */
export function createAnthropicProvider(): LLMProviderFactory {
  return (config: Record<string, string>) => {
    const client = new Anthropic({ apiKey: config.apiKey });

    function toAnthropicMessages(
      messages: CompletionRequest['messages']
    ): Anthropic.Messages.MessageParam[] {
      return messages
        .filter((m) => m.role !== 'system')
        .map((m) => {
          if (m.role === 'tool') {
            return {
              role: 'user' as const,
              content: [
                {
                  type: 'tool_result' as const,
                  tool_use_id: m.tool_call_id!,
                  content: m.content ?? '',
                },
              ],
            };
          }

          if (m.role === 'assistant' && m.tool_calls?.length) {
            return {
              role: 'assistant' as const,
              content: [
                ...(m.content
                  ? [{ type: 'text' as const, text: m.content }]
                  : []),
                ...m.tool_calls.map((tc) => ({
                  type: 'tool_use' as const,
                  id: tc.id,
                  name: tc.function.name,
                  input: JSON.parse(tc.function.arguments || '{}'),
                })),
              ],
            };
          }

          return {
            role: m.role as 'user' | 'assistant',
            content: m.content ?? '',
          };
        });
    }

    function toAnthropicTools(
      tools: CompletionRequest['tools']
    ): Anthropic.Messages.Tool[] {
      if (!tools) return [];
      return tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: {
          type: 'object',
          properties: (t.function.parameters.properties ?? {}) as Record<
            string,
            unknown
          >,
          required: t.function.parameters.required ?? [],
        },
      }));
    }

    const llmClient: LLMClient = {
      async complete(req: CompletionRequest): Promise<CompletionResponse> {
        const systemMsg = req.messages.find((m) => m.role === 'system');

        const resp = await client.messages.create({
          model: req.model,
          max_tokens: 4096,
          system: systemMsg?.content ?? undefined,
          messages: toAnthropicMessages(req.messages),
          tools: toAnthropicTools(req.tools),
        });

        const toolCalls: ToolCallDelta[] = [];
        let text = '';

        for (const block of resp.content) {
          if (block.type === 'text') {
            text += block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          }
        }

        return {
          content: text || null,
          toolCalls,
          usage: {
            promptTokens: resp.usage.input_tokens,
            completionTokens: resp.usage.output_tokens,
          },
        };
      },

      async *completeStream(
        req: CompletionRequest
      ): AsyncGenerator<StreamingChunk> {
        const systemMsg = req.messages.find((m) => m.role === 'system');

        const stream = client.messages.stream({
          model: req.model,
          max_tokens: 4096,
          system: systemMsg?.content ?? undefined,
          messages: toAnthropicMessages(req.messages),
          tools: toAnthropicTools(req.tools),
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              yield { type: 'content', content: event.delta.text };
            }
          }
        }

        const finalMsg = await stream.finalMessage();
        for (const block of finalMsg.content) {
          if (block.type === 'tool_use') {
            yield {
              type: 'tool_call',
              toolCall: {
                id: block.id,
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input),
                },
              },
            };
          }
        }

        yield { type: 'done' };
      },
    };

    return llmClient;
  };
}
