import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type {
  LLMClient,
  LLMProviderFactory,
  CompletionRequest,
  CompletionResponse,
  ToolCallDelta,
  StreamingChunk,
} from '../types.js';

export function createOpenAICompatProvider(defaultBaseURL: string): LLMProviderFactory {
  return (config: Record<string, string>) => {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || defaultBaseURL,
    });

    const llmClient: LLMClient = {
      async complete(req: CompletionRequest): Promise<CompletionResponse> {
        const resp = await client.chat.completions.create({
          model: req.model,
          messages: req.messages as ChatCompletionMessageParam[],
          tools: req.tools?.length
            ? req.tools.map((t) => ({
                type: 'function' as const,
                function: t.function,
              }))
            : undefined,
          tool_choice: req.tool_choice ?? 'auto',
        });

        const choice = resp.choices[0];
        const toolCalls: ToolCallDelta[] =
          choice?.message?.tool_calls
            ?.filter((tc) => tc.type === 'function')
            .map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })) ?? [];

        return {
          content: choice?.message?.content ?? null,
          toolCalls,
          usage: resp.usage
            ? {
                promptTokens: resp.usage.prompt_tokens,
                completionTokens: resp.usage.completion_tokens,
              }
            : undefined,
        };
      },

      async *completeStream(req: CompletionRequest): AsyncGenerator<StreamingChunk> {
        const stream = await client.chat.completions.create({
          model: req.model,
          messages: req.messages as ChatCompletionMessageParam[],
          tools: req.tools?.length
            ? req.tools.map((t) => ({
                type: 'function' as const,
                function: t.function,
              }))
            : undefined,
          tool_choice: req.tool_choice ?? 'auto',
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            yield { type: 'content', content: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: tc.id ?? '',
                  type: 'function' as const,
                  function: {
                    name: tc.function?.name ?? '',
                    arguments: tc.function?.arguments ?? '',
                  },
                },
              };
            }
          }
          if (chunk.choices[0]?.finish_reason) {
            yield { type: 'done' };
          }
        }
      },
    };

    return llmClient;
  };
}
