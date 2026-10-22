export function activeQuote(quote,checkIn,checkOut){
 return quote?.kind==='official_reference'&&quote.currency==='CNY'&&Number.isFinite(quote.amount)&&quote.amount>0&&quote.checkIn===checkIn&&quote.checkOut===checkOut?quote:null;
}
export function memberEstimate(amount,percent){
 return Math.round(Math.round(amount*100)*percent/100)/100;
}
export const money=value=>Number(value).toLocaleString('zh-CN',{maximumFractionDigits:2});
