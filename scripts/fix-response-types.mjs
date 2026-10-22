import fs from 'node:fs/promises';
const file='app/page.tsx';let s=await fs.readFile(file,'utf8');
s=s.replace("const date=(offset=0)","type Dataset={hotels:Hotel[],collectedAt:string,nextPage:number|null,errors:{id:string,error:string}[],error?:string};\nconst date=(offset=0)");
s=s.replace("return r.json()}","return r.json() as Promise<Dataset>}");
s=s.replace("d=await r.json();if(!r.ok)throw Error(d.error||'读取失败')","d=await r.json() as Dataset;if(!r.ok)throw Error(d.error||'读取失败')");
s=s.replace("d=await r.json();if(!r.ok)throw Error(d.error)","d=await r.json() as Hotel & {error?:string};if(!r.ok)throw Error(d.error)");
await fs.writeFile(file,s);
