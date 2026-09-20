const ALLOWED_ORDER_TYPES = new Set(['MARKET','LIMIT','SL','SL-M']);
const ALLOWED_TRANSACTIONS = new Set(['BUY','SELL']);
const ALLOWED_VALIDITY = new Set(['DAY','IOC']);

export function createUpstoxBrokerAdapter({ config, transport }) {
  if (!config) throw new Error('Upstox config is required.');
  if (!transport) throw new Error('Transport is required.');
  const live = config.environment === 'LIVE';

  async function request(path, options = {}) {
    if (live && config.liveExecutionEnabled !== true) {
      throw new Error('LIVE_EXECUTION_REQUIRES_EXPLICIT_ACTIVATION');
    }
    return transport.request(path, options);
  }

  function validateOrder(order) {
    if (!order?.instrumentToken) throw new Error('instrumentToken is required.');
    if (!Number.isInteger(order.quantity) || order.quantity <= 0) throw new Error('quantity must be a positive integer.');
    if (!ALLOWED_ORDER_TYPES.has(order.orderType)) throw new Error('Unsupported orderType.');
    if (!ALLOWED_TRANSACTIONS.has(order.transactionType)) throw new Error('Unsupported transactionType.');
    if (!ALLOWED_VALIDITY.has(order.validity)) throw new Error('Unsupported validity.');
    if (order.orderType === 'LIMIT' && !(Number.isFinite(order.price) && order.price > 0)) throw new Error('LIMIT orders require positive price.');
    return true;
  }

  return Object.freeze({
    environment: config.environment,
    async placeOrder(order) {
      validateOrder(order);
      const payload = {
        quantity: order.quantity, product: order.product ?? 'D', validity: order.validity,
        price: order.price ?? 0, tag: order.tag, instrument_token: order.instrumentToken,
        order_type: order.orderType, transaction_type: order.transactionType,
        disclosed_quantity: order.disclosedQuantity ?? 0, trigger_price: order.triggerPrice ?? 0,
        is_amo: order.isAmo ?? false, slice: order.slice ?? false
      };
      return request('/v3/order/place', {method:'POST', body:payload});
    },
    async modifyOrder(order) {
      if (!order?.orderId) throw new Error('orderId is required.');
      return request('/v3/order/modify', {method:'PUT', body:{...order, order_id: order.order_id ?? order.orderId}});
    },
    async cancelOrder(orderId) {
      if (!orderId) throw new Error('orderId is required.');
      return request('/v3/order/cancel?order_id=' + encodeURIComponent(orderId), {method:'DELETE'});
    },
    async getOrderHistory(orderId) {
      return request('/v2/order/history' + (orderId ? '?order_id=' + encodeURIComponent(orderId) : ''), {method:'GET'});
    },
    validateOrder
  });
}