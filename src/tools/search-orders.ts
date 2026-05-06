import type { ToolDef } from './types.js';

interface Order {
  orderId: string;
  customer: string;
  status: string;
  items: string[];
  total: number;
  createdAt: string;
  tracking?: string;
}

const orders: Order[] = [
  {
    orderId: 'ORD-001',
    customer: '张三',
    status: '已发货',
    items: ['iPhone 15 Pro', '手机壳'],
    total: 8999,
    createdAt: '2026-05-01',
    tracking: 'SF1234567890',
  },
  {
    orderId: 'ORD-002',
    customer: '张三',
    status: '待付款',
    items: ['MacBook Pro 14"'],
    total: 14999,
    createdAt: '2026-05-05',
  },
  {
    orderId: 'ORD-003',
    customer: '李四',
    status: '已完成',
    items: ['AirPods Pro'],
    total: 1899,
    createdAt: '2026-04-28',
    tracking: 'SF0987654321',
  },
  {
    orderId: 'ORD-004',
    customer: '王五',
    status: '已取消',
    items: ['iPad Air'],
    total: 4799,
    createdAt: '2026-05-03',
  },
  {
    orderId: 'ORD-005',
    customer: '张三',
    status: '待发货',
    items: ['Apple Watch', '表带'],
    total: 3299,
    createdAt: '2026-05-06',
  },
];

export const searchOrdersDef: ToolDef = {
  type: 'function',
  function: {
    name: 'search_orders',
    description: '根据订单号或客户姓名查询订单信息。返回订单的状态、商品、金额、物流等详情。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '订单号（如 ORD-001）或客户姓名',
        },
      },
      required: ['query'],
    },
  },
};

export function searchOrders(query: string): string {
  const q = query.trim();
  const results = orders.filter(
    (o) =>
      o.orderId.toLowerCase().includes(q.toLowerCase()) ||
      o.customer.includes(q)
  );

  if (results.length === 0) {
    return JSON.stringify({ found: false, message: `未找到与 "${q}" 相关的订单` });
  }

  return JSON.stringify({ found: true, count: results.length, orders: results });
}
