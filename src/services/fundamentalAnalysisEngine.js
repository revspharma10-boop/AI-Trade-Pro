// AI TRADE PRO — FUNDAMENTAL ANALYSIS ENGINE
// Deterministic scoring from Upstox Company Fundamentals payloads. Missing evidence fails closed.

const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const pct=v=>{const n=parseFloat(String(v??'').replace('%',''));return Number.isFinite(n)?n:null;};
const latestChange=(statement,category)=>{
  const row=statement?.find(x=>String(x.category).toLowerCase()===category);
  return pct(row?.history?.[0]?.change);
};
const ratioMap=data=>{
  const m={}; for(const x of Array.isArray(data)?data:[]){const k=String(x.name||x.ratio||x.key||'').toUpperCase().replace(/[^A-Z]/g,'');m[k]={value:Number(x.value),sector:Number(x.sector_value)};} return m;
};
const growthScore=v=>v===null?null:clamp(50+v*2);
const returnScore=v=>!Number.isFinite(v)?null:clamp(v*3);
const valuationScore=(v,s)=>!Number.isFinite(v)?null:Number.isFinite(s)&&s>0?clamp(70+(s-v)/s*50):(v<=20?80:v<=35?65:45);

export function analyzeFundamentals({profile,income,balance,cashFlow,keyRatios}={}){
  const reasons=[];
  const inc=income?.income_statement, cf=cashFlow?.cash_flow||cashFlow?.cash_flow_statement, ratios=ratioMap(keyRatios);
  const revenueGrowth=latestChange(inc,'revenue'), profitGrowth=latestChange(inc,'net_profit'), operatingGrowth=latestChange(inc,'operating_profit');
  const operatingCashGrowth=latestChange(cf,'operating');
  const roe=ratios.ROE?.value, roce=ratios.ROCE?.value, pe=ratios.PE?.value, peSector=ratios.PE?.sector;
  const bh=balance?.history;
  if(!profile?.sector)reasons.push('COMPANY_PROFILE_MISSING');
  if(revenueGrowth===null||profitGrowth===null)reasons.push('INCOME_HISTORY_INCOMPLETE');
  if(!Number.isFinite(roe)||!Number.isFinite(roce))reasons.push('RETURN_RATIOS_MISSING');
  if(!Array.isArray(bh)||!bh.length)reasons.push('BALANCE_SHEET_MISSING');
  if(operatingCashGrowth===null)reasons.push('CASH_FLOW_HISTORY_INCOMPLETE');
  if(!Number.isFinite(pe))reasons.push('VALUATION_RATIO_MISSING');
  if(reasons.length)return {valid:false,reasons,scores:null,evidence:[]};

  const latest=bh[0], liabilityRatio=Number(latest.total_asset)>0?Number(latest.total_liability)/Number(latest.total_asset):null;
  if(!Number.isFinite(liabilityRatio))return {valid:false,reasons:['BALANCE_SHEET_INVALID'],scores:null,evidence:[]};
  const scores={
    revenueGrowth:growthScore(revenueGrowth),
    profitGrowth:growthScore(profitGrowth),
    profitability:growthScore(operatingGrowth??profitGrowth),
    roeRoce:clamp((returnScore(roe)+returnScore(roce))/2),
    debt:clamp(100-liabilityRatio*100),
    cashFlow:growthScore(operatingCashGrowth),
    valuation:valuationScore(pe,peSector),
    earningsConsistency:clamp((growthScore(revenueGrowth)+growthScore(profitGrowth))/2),
    businessSector:65,
    riskFlags:liabilityRatio<=0.6?80:liabilityRatio<=0.75?60:35
  };
  return {
    valid:true,scores,
    snapshot:{sector:profile.sector,revenueGrowth,profitGrowth,operatingProfitGrowth:operatingGrowth,roe,roce,pe,sectorPe:Number.isFinite(peSector)?peSector:null,liabilityToAsset:Number((liabilityRatio*100).toFixed(2)),operatingCashFlowGrowth:operatingCashGrowth},
    evidence:[`Revenue growth ${revenueGrowth}%`,`Net profit growth ${profitGrowth}%`,`ROE ${roe}% / ROCE ${roce}%`,`P/E ${pe}${Number.isFinite(peSector)?' vs sector '+peSector:''}`,`Liabilities/assets ${(liabilityRatio*100).toFixed(2)}%`,`Operating cash-flow growth ${operatingCashGrowth}%`,`Sector: ${profile.sector}`]
  };
}
