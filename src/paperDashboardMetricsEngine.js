// AI TRADE PRO — PAPER DASHBOARD METRICS
export function buildPaperDashboardMetrics(input={}){return Object.freeze({signals:Number(input.signals)||0,accepted:Number(input.accepted)||0,rejected:Number(input.rejected)||0,openPositions:Number(input.openPositions)||0,realizedPnL:Number(input.realizedPnL)||0,winRate:Number(input.winRate)||0,maxDrawdown:Number(input.maxDrawdown)||0,dataQuality:input.dataQuality||'UNKNOWN',paperOnly:true,realOrderPlaced:false,productionRealTradingEnabled:false});}
console.log('AI TRADE PRO — paper dashboard metrics engine loaded');
