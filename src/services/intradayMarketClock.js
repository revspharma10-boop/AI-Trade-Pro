// Exchange-local clock checks for intraday research; not an exchange holiday calendar.
// Non-agri MCX daylight schedules are versioned to verified 2026/27 notices.
// Special trading days, holidays, commodity-specific cutoffs and broker square-off
// MUST be separately verified before actionable recommendations.
const indiaDate=ms=>new Date(ms+330*60000).toISOString().slice(0,10);
export const MCX_COMMODITY_GROUPS=Object.freeze({
 NON_AGRI:['GOLD','GOLDM','GOLDGUINEA','GOLDPETAL','SILVER','SILVERM','SILVERMIC','SILVERMICRO',
  'CRUDEOIL','CRUDEOILM','NATURALGAS','NATGASMINI','NATURALGASM','COPPER','COPPERM',
  'ZINC','ZINCMINI','ALUMINIUM','ALUMINI','LEAD','LEADMINI','NICKEL','MCXBULLDEX','MCXMETLDEX','MCXENRGDEX'],
 SELECT_AGRI:['COTTON','COTTONCNDY','COTTONCANDY','CPO','KAPAS','COTTONSEEDOIL'],
 OTHER_AGRI:['MENTHAOIL','MENTHA']
});
export function commodityGroup(underlyingSymbol=''){
 const key=String(underlyingSymbol).toUpperCase().replace(/[^A-Z0-9]/g,'');
 if(!key)return 'UNKNOWN';
 for(const [name,symbols] of Object.entries(MCX_COMMODITY_GROUPS)){
  if(symbols.includes(key))return name;
 }
 return 'UNKNOWN';
}
function nonAgriClose(date){
 if(date>='2026-03-09'&&date<='2026-10-30')return 1410; // 23:30 IST
 if(date>='2026-11-02'&&date<='2027-03-12')return 1435; // 23:55 IST
 return null; // fail closed outside verified calendar intervals
}
export function marketClockState({segment='NSE_EQ',underlyingSymbol='',asOf=Date.now(),exitBufferMinutes=15}={}){
 const time=Number(new Date(asOf));
 if(!Number.isFinite(time))return {open:false,clockOpen:false,reason:'INVALID_CLOCK',holidayCalendarVerified:false};
 const ist=new Date(time+330*60000),day=ist.getUTCDay(),date=indiaDate(time);
 const minutes=ist.getUTCHours()*60+ist.getUTCMinutes();
 const isWeekday=day>=1&&day<=5;
 if(['NSE_EQ','NSE_FO','NSE_INDEX','BSE_INDEX','BSE_FO'].includes(segment)){
  const exchange=segment.startsWith('BSE')?'BSE':'NSE';
  const clockOpen=isWeekday&&minutes>=555&&minutes<930;
  const open=clockOpen&&minutes<930-exitBufferMinutes;
  return {exchange,date,open,clockOpen,group:'EQUITY_OR_FO',closeMinutes:930,
   reason:!clockOpen?exchange+'_CLOCK_CLOSED':!open?'NEAR_MARKET_CLOSE':'CLOCK_OPEN_HOLIDAY_UNVERIFIED',
   holidayCalendarVerified:false,brokerSquareOffVerified:false};
 }
 if(segment!=='MCX_FO')return {exchange:'UNKNOWN',date,open:false,clockOpen:false,
  reason:'UNSUPPORTED_MARKET_SEGMENT',holidayCalendarVerified:false,brokerSquareOffVerified:false};
 const group=commodityGroup(underlyingSymbol);
 const close=group==='NON_AGRI'?nonAgriClose(date):group==='SELECT_AGRI'?1260:group==='OTHER_AGRI'?1020:null;
 if(close===null)return {exchange:'MCX',group,date,open:false,clockOpen:false,closeMinutes:null,
  reason:group==='UNKNOWN'?'UNKNOWN_COMMODITY_SESSION':'MCX_SESSION_CALENDAR_NOT_VERIFIED',
  holidayCalendarVerified:false,brokerSquareOffVerified:false};
 const clockOpen=isWeekday&&minutes>=540&&minutes<close;
 const open=clockOpen&&minutes<close-exitBufferMinutes;
 return {exchange:'MCX',group,date,open,clockOpen,closeMinutes:close,
  reason:!clockOpen?'MCX_CLOCK_CLOSED':!open?'NEAR_MARKET_CLOSE':'CLOCK_OPEN_HOLIDAY_UNVERIFIED',
  holidayCalendarVerified:false,brokerSquareOffVerified:false};
}


// Source-versioned published 2026 NSE/BSE equity closure calendar.
// Planned open dates DO NOT verify actual market availability, Upstox feed,
// emergency exchange circulars or broker square-off times.
export const EQUITY_CALENDAR_2026_VERSION='NSE_BSE_EQUITY_2026_V1';
const EQUITY_HOLIDAYS_2026=new Set([
 '2026-01-15','2026-01-26','2026-03-03','2026-03-26',
 '2026-03-31','2026-04-03','2026-04-14','2026-05-01',
 '2026-05-28','2026-06-26','2026-09-14','2026-10-02',
 '2026-10-20','2026-11-10','2026-11-24','2026-12-25'
]);
const EQUITY_EXCHANGES=Object.freeze({
 NSE_EQ:'NSE',NSE_INDEX:'NSE',NSE_FO:'NSE',
 BSE_INDEX:'BSE',BSE_FO:'BSE'
});
export function publishedEquitySession2026({segment,asOf=Date.now()}={}){
 const exchange=EQUITY_EXCHANGES[segment]??null;
 const now=Number(new Date(asOf));
 const base={exchange,date:null,regularSessionPlanned:false,
  sourceVersion:EQUITY_CALENDAR_2026_VERSION,liveSessionVerified:false};
 if(!exchange)return {...base,reason:'EQUITY_CALENDAR_SEGMENT_UNSUPPORTED'};
 if(!Number.isFinite(now))return {...base,reason:'EQUITY_CALENDAR_INVALID_CLOCK'};
 const local=new Date(now+330*60000),date=local.toISOString().slice(0,10);
 const state={...base,date};
 if(!date.startsWith('2026-'))return {...state,reason:'EQUITY_CALENDAR_YEAR_UNVERIFIED'};
 if(date==='2026-11-08')return {...state,reason:'EQUITY_SPECIAL_SESSION_UNVERIFIED'};
 if([0,6].includes(local.getUTCDay()))return {...state,reason:'EQUITY_MARKET_WEEKEND'};
 if(EQUITY_HOLIDAYS_2026.has(date))return {...state,reason:'EQUITY_EXCHANGE_HOLIDAY'};
 return {...state,regularSessionPlanned:true,reason:'EQUITY_REGULAR_DAY_SCHEDULED'};
}
