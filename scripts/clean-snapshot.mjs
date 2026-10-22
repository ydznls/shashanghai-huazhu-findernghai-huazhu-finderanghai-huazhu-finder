import fs from 'node:fs/promises';
const path='data/official-snapshot.json',d=JSON.parse(await fs.readFile(path,'utf8'));
d.hotels=d.hotels.filter(h=>!/虚拟|测试|停业|歇业|酒店停$|质量整改/.test(h.name)).map(h=>({...h,score:h.reviewCount>0?h.score:null}));
await fs.writeFile(path,JSON.stringify(d,null,2));console.log(d.hotels.length);
