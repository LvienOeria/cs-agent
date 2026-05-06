import type { ToolDef } from './types.js';

export const transferHumanDef: ToolDef = {
  type: 'function',
  function: {
    name: 'transfer_to_human',
    description:
      '当用户的问题超出 AI 客服能力范围，或用户明确要求人工服务时，将对话转接给人工客服。转接前需先总结用户问题。',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: '转接原因，简要描述为什么需要人工介入',
        },
        summary: {
          type: 'string',
          description: '用户问题的简要总结，方便人工客服快速了解情况',
        },
      },
      required: ['reason', 'summary'],
    },
  },
};

export function transferToHuman(reason: string, summary: string): string {
  return JSON.stringify({
    transferred: true,
    reason,
    summary,
    message: '已为您转接人工客服，请稍候。预计等待时间：2分钟',
    ticketId: `TK-${Date.now()}`,
  });
}
