import type { ToolDef } from './types.js';
import { knowledgeBase } from '../rag/knowledge-base.js';

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
      },
      required: ['query'],
    },
  },
};

export function searchKnowledgeBase(query: string): string {
  const results = knowledgeBase.search(query, 3);

  if (results.length === 0) {
    return JSON.stringify({ found: false, message: '未找到相关知识库内容' });
  }

  const items = results.map((r) => ({
    id: r.document.id,
    content: r.document.content,
    relevance: Math.round(r.score * 100) / 100,
  }));

  return JSON.stringify({ found: true, count: items.length, items });
}
