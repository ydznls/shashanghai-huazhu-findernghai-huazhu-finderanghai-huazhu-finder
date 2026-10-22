import fs from 'node:fs/promises';
const evidence=JSON.parse(await fs.readFile('data/brand-evidence.json','utf8'));
const definitions=[
 ['宋品','奢华',['song'],'song'],['施柏阁大观','奢华',['Steigenberger Icons'],'steigenberger-icons'],
 ['禧玥','高档',['禧玥酒店','JOYA'],'joya'],['花间堂','高档',['Blossom House','花间府'],'huajiantang'],['施柏阁','高档',['Steigenberger'],'steigenberger'],['美仑美奂','高档',['美轮美奂','MAXX'],'maxx'],['美仑国际','高档',['Grand Madison'],'grand-madison'],['永乐半山','高档',[],'lebanshan'],['诺富特','高档',['Novotel'],'novotel'],['美爵','高档',['Grand Mercure'],'grand-mercure'],
 ['全季大观','精选',[],'ji-grand'],['桔子水晶','精选',['Crystal Orange','桔子水晶酒店'],'juzishuijing'],['城际','精选',['城际酒店','IntercityHotel','Intercity'],'intercity'],['漫心府','精选',[],'manxin-mansion'],['美居','精选',['Mercure'],'mercure'],['CitiGO欢阁','精选',['CitiGO酒店','CitiGO','欢阁酒店','欢阁'],'citigo'],['美仑','精选',['美仑酒店','Madison'],'madison'],
 ['全季','中档',['全季酒店','JI Hotel'],'quanji'],['桔子','中档',['桔子精选','桔子酒店','Orange Hotel'],'juzi'],['漫心','中档',['漫心酒店','Manxin'],'manxin'],['星程','中档',['星程酒店','Starway'],'starway'],
 ['汉庭','国民',['汉庭酒店','Hanting'],'hanting'],['汉庭快捷','国民',[],'hanting-express'],['你好','国民',['你好酒店','Ni Hao'],'nihao'],['海友','国民',['海友良品','海友酒店','Hi Inn'],'hi-lnn'],['宜必思','国民',['ibis'],'ibis'],['宜必思尚品','国民',['ibis Styles','ibis尚品'],'ibis-styles'],
 ['城家公寓酒店','旅居',['城家高级公寓'],'cjia-apartment-prime'],['瑞贝庭公寓酒店','旅居',['瑞贝庭','瑞贝庭公寓'],'ruibeiting'],['馨乐庭','旅居',['Citadines'],'citadines'],
 ['城家公寓','服务式公寓',['Cjia'],'cjia-apartment'],['CitiGO HOUSE欢阁服务公寓','服务式公寓',['CitiGO HOUSE','CitiGOHOUSE','欢阁服务公寓'],'citigo-house'],['城家奢华公寓','服务式公寓',[],'cjia-lux'],['励业公寓','服务式公寓',['励业'],'li-yeah'],
 ['碧舍','生活方式',['BISE'],'bise'],['Jaz in the City','生活方式',['Jaz','jaz'],'jaz'],
 ['Zleep Hotels','国际品牌',['Zleep'],'zleep'],
 ['怡莱','存量品牌',['怡莱酒店','怡莱精品','Elan'],'elan'],['汉庭优佳','存量品牌',[],'hanting-youjia']
];
const source=evidence.source;
const catalog=definitions.map(([name,category,aliases,code])=>({id:code,name,category,aliases:[name,...aliases],searchTerms: name==='CitiGO欢阁'?['CitiGO','欢阁']:name==='CitiGO HOUSE欢阁服务公寓'?['CitiGO HOUSE','欢阁服务公寓']:name==='城家公寓酒店'?['城家高级公寓','城家公寓酒店']:name==='美仑'?['美仑酒店']:name==='Jaz in the City'?['Jaz']:name==='Zleep Hotels'?['Zleep']:[name],source:category==='国际品牌'?'https://ir.hworld.com/zh-hans/':category==='存量品牌'?'https://m.huazhu.com/':source,sourceUrl:evidence.all.find(b=>b.code===code)?'https://www.hworld.com/hotel/'+code:source}));
await fs.writeFile('data/brand-catalog.json',JSON.stringify({checkedAt:evidence.checkedAt,source,categories:['全部品类','国民','中档','精选','高档','奢华','旅居','服务式公寓','生活方式','国际品牌','存量品牌'],brands:catalog},null,2));
console.log(JSON.stringify({brands:catalog.length,categories:[...new Set(catalog.map(b=>b.category))]}));
