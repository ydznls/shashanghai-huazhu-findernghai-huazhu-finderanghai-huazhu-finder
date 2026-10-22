import catalog from '../data/brand-catalog.json' with {type:'json'};
export const BRAND_CATALOG=catalog.brands;
export const BRAND_CATEGORIES=catalog.categories;
export const BRAND_CHECKED_AT=catalog.checkedAt;
export const BRAND_SOURCE=catalog.source;
const compact=value=>String(value||'').toLowerCase().replace(/[\s·.\-_（）()]/g,'');
const aliases=BRAND_CATALOG.flatMap(brand=>brand.aliases.map(alias=>({brand,alias:compact(alias)}))).sort((a,b)=>b.alias.length-a.alias.length||compact(b.brand.name).length-compact(a.brand.name).length);
export function getBrand(value){return BRAND_CATALOG.find(b=>b.id===value||b.name===value)||null;}
export function matchBrand(brandName='',hotelName=''){
 // Longest match across both fields prevents specific series being swallowed by a parent label.
 const texts=[compact(brandName),compact(hotelName)];
 if(texts.some(text=>text.includes('城家')&&text.includes('公寓酒店')&&!text.includes('奢华')))return getBrand('城家公寓酒店');
 return aliases.find(item=>texts.some(text=>text.includes(item.alias)))?.brand||null;
}
