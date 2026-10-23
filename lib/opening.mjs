// The official detail response stores the property's opening date separately
// from its description. Parse the calendar date without timezone conversion.
export function openingFromBusinessDate(value,{sourceUrl,checkedAt}={}){
 if(typeof value!=='string'||!value.trim())return null;
 const raw=value.trim(),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
 const english=raw.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})(?:$|\s)/);
 if(!iso&&!english)return null;
 const year=Number(iso?.[1]??english?.[3]),month=iso?Number(iso[2]):months.indexOf(english[1])+1,day=Number(iso?.[3]??english?.[2]);
 const date=new Date(Date.UTC(year,month-1,day));
 if(year<1900||year>new Date().getUTCFullYear()||month<1||month>12||day<1||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 const calendar=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 return {year,month,day,date:calendar,evidence:`华住官方酒店详情：${year}年${month}月${day}日开业`,field:'businessDate',...(sourceUrl?{sourceUrl}:{}),...(checkedAt?{checkedAt}:{})};
}
