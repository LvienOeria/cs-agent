import { randomUUID } from 'node:crypto';
import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
  type Tool,
} from '@google/generative-ai';
import type {
  LLMProviderFactory,
  LLMClient,
  CompletionRequest,
  CompletionResponse,
  ToolCallDelta,
  StreamingChunk,
} from '../types.js';

/**
 * Google Gemini adapter.
 *
 * Key differences from OpenAI-compatible API:
 * - Messages are Content[] with Parts[] instead of role/content pairs
 * - System prompt goes in systemInstruction config
 * - Tool calls use functionCall / functionResponse part types
 * - tool role messages become functionResponse parts in user content
 */
export function createGeminiProvider(): LLMProviderFactory {
  return (config: Record<string, string>) => {
    const genAI = new GoogleGenerativeAI(config.apiKey);

    function toGeminiContents(
      messages: CompletionRequest['messages']
    ): Content[] {
      return messages
        .filter((m) => m.role !== 'system')
        .map((m): Content => {
          const parts: Part[] = [];

          if (m.role === 'tool') {
            parts.push({
              functionResponse: {
                name: m.name ?? '',
                response: JSON.parse(m.content ?? '{}'),
              },
            });
          } else if (m.role === 'assistant' && m.tool_calls?.length) {
            if (m.content) parts.push({ text: m.content });
            for (const tc of m.tool_calls) {
              parts.push({
                functionCall: {
                  name: tc.function.name,
                  args: JSON.parse(tc.function.arguments || '{}'),
                },
              });
            }
          } else if (m.content) {
            parts.push({ text: m.content });
          }

          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts,
          };
        });
    }

    function toGeminiTools(
      tools: CompletionRequest['tools']
    ): Tool[] {
      if (!tools?.length) return [];
      const declarations: FunctionDeclaration[] = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters as FunctionDeclaration['parameters'],
      }));
      return [{ functionDeclarations: declarations }];
    }

    function geminiPartToToolCall(part: Part): ToolCallDelta | null {
      if (!part.functionCall) return null;
      return {
        id: randomUUID(),
        index: 0,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        },
      };
    }

    const llmClient: LLMClient = {
      async complete(req: CompletionRequest): Promise<CompletionResponse> {
        const systemMsg = req.messages.find((m) => m.role === 'system');
        const model = genAI.getGenerativeModel({
          model: req.model,
          systemInstruction: systemMsg?.content ?? undefined,
          tools: toGeminiTools(req.tools),
        });

        const contents = toGeminiContents(req.messages);
        const result = await model.generateContent({ contents });
        const resp = result.response;

        const toolCalls: ToolCallDelta[] = [];
        let text = '';

        if (resp.candidates?.[0]?.content?.parts) {
          for (const part of resp.candidates[0].content.parts) {
            if (part.text) text += part.text;
            const tc = geminiPartToToolCall(part);
            if (tc) toolCalls.push(tc);
          }
        }

        return {
          content: text || null,
          toolCalls,
          usage: resp.usageMetadata
            ? {
                promptTokens: resp.usageMetadata.promptTokenCount,
                completionTokens: resp.usageMetadata.candidatesTokenCount,
              }
            : undefined,
        };
      },

      async *completeStream(
        req: CompletionRequest
      ): AsyncGenerator<StreamingChunk> {
        const systemMsg = req.messages.find((m) => m.role === 'system');
        const model = genAI.getGenerativeModel({
          model: req.model,
          systemInstruction: systemMsg?.content ?? undefined,
          tools: toGeminiTools(req.tools),
        });

        const contents = toGeminiContents(req.messages);
        const stream = await model.generateContentStream({ contents });

        for await (const chunk of stream.stream) {
          const parts = chunk.candidates?.[0]?.content?.parts;
          if (!parts) continue;

          for (const part of parts) {
            if (part.text) {
              yield { type: 'content', content: part.text };
            }
            const tc = geminiPartToToolCall(part);
            if (tc) {
              yield { type: 'tool_call', toolCall: tc };
            }
          }
        }

        yield { type: 'done' };
      },
    };

    return llmClient;
  };
}
