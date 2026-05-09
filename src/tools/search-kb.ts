import type { ToolDef } from './types.js';
import type { Retriever } from '../rag/types.js';

let retriever: Retriever | null = null;

export function setRetriever(r: Retriever): void {
  retriever = r;
}

export const searchKbDef: ToolDef = {
  type: 'function',
  function: {
    name: 'search_knowledge_base',
    description:
      '搜索内部知识库，获取公司政策、退货规则、物流信息、会员制度等官方信息。当用户询问关于退货、发货、保修、支付、会员等公司政策相关问题时，必须先调用此工具。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词或问题，例如："退货政策"、"会员等级"、"发货时间"',
        },
        tenantId: {
          type: 'string',
          description: '租户ID（可选），用于隔离不同客户的知识库',
        },
      },
      required: ['query'],
    },
  },
};

export async function searchKnowledgeBase(query: string, tenantId?: string): Promise<string> {
  if (!retriever) {
    return JSON.stringify({ found: false, message: '知识库未初始化' });
  }

  const results = await retriever.search(query, 3, tenantId);

  if (results.length === 0) {
    return JSON.stringify({ found: false, message: '未找到相关知识库内容' });
  }

  const items = results.map((r) => ({
    id: r.chunk.id,
    content: r.chunk.content,
    relevance: Math.round(r.score * 100) / 100,
  }));

  return JSON.stringify({ found: true, count: items.length, items });
}
