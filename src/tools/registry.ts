import type { ToolDef, ToolResult } from './types.js';
import { searchOrdersDef, searchOrders } from './search-orders.js';
import { searchKbDef, searchKnowledgeBase } from './search-kb.js';
import { transferHumanDef, transferToHuman } from './transfer-human.js';
import { logger } from '../observability/logger.js';

type ToolExecutor = (args: Record<string, unknown>) => string | Promise<string>;

interface ToolEntry {
  def: ToolDef;
  execute: ToolExecutor;
}

const registry = new Map<string, ToolEntry>();

function register(def: ToolDef, execute: ToolExecutor): void {
  registry.set(def.function.name, { def, execute });
}

register(searchOrdersDef, (args) => searchOrders(String(args.query ?? '')));
register(searchKbDef, (args) => searchKnowledgeBase(String(args.query ?? ''), args.tenantId as string | undefined));
register(transferHumanDef, (args) =>
  transferToHuman(String(args.reason ?? ''), String(args.summary ?? ''))
);

export function getAllToolDefs(): ToolDef[] {
  return Array.from(registry.values()).map((e) => e.def);
}

export async function executeTool(
  toolCallId: string,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const entry = registry.get(name);
  if (!entry) {
    logger.warn({ toolName: name }, 'Unknown tool called by LLM');
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      content: JSON.stringify({ error: true, message: `Unknown tool: ${name}` }),
    };
  }

  const start = Date.now();
  try {
    const content = await entry.execute(args);
    logger.info({ toolName: name, durationMs: Date.now() - start }, 'Tool executed successfully');
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      content,
    };
  } catch (err) {
    logger.error(
      { toolName: name, err, durationMs: Date.now() - start },
      'Tool execution failed'
    );
    return {
      tool_call_id: toolCallId,
      role: 'tool',
      content: JSON.stringify({
        error: true,
        message: err instanceof Error ? err.message : 'Tool execution failed',
      }),
    };
  }
}
