// Cache original catalogue PDFs, optionally reusing Antigravity's old scratch/pdfs.
const fs=require("fs"),path=require("path"),crypto=require("crypto");
global.window={};require("../data.js");
const [out,scratch]=process.argv.slice(2);
if(!path.isAbsolute(out))throw Error("Pass the absolute legacy staging path");
fs.mkdirSync(out,{recursive:true});
const map=new Map();
if(scratch){
  const text=fs.readFileSync(path.join(scratch,"download_all.js"),"utf8");
  for(const [,name,id] of text.matchAll(/\["([\w-]+)", "([\w-]+)"\]/g))map.set(id,path.join(scratch,"pdfs",name+".pdf"));
}
const rows=window.MUHS_DATA.defaultPapers.map(p=>({id:p.id.slice(7),subject:p.subjectId,name:p.title}));
let i=0;
async function worker(){
  while(i<rows.length){
    const r=rows[i++],dest=path.join(out,r.id+".pdf");
    let b;
    if(fs.existsSync(dest))b=fs.readFileSync(dest);
    else if(map.has(r.id)&&fs.existsSync(map.get(r.id)))b=fs.readFileSync(map.get(r.id));
    else{
      const res=await fetch("https://drive.usercontent.google.com/download?confirm=t&export=download&id="+r.id,{signal:AbortSignal.timeout(90000)});
      if(!res.ok)throw Error(res.status+" for "+r.id);
      b=Buffer.from(await res.arrayBuffer());
    }
    if(b.subarray(0,5).toString()!=="%PDF-"||!b.subarray(-4096).includes(Buffer.from("%%EOF")))throw Error("Invalid PDF "+r.id);
    fs.writeFileSync(dest,b);r.bytes=b.length;r.sha256=crypto.createHash("sha256").update(b).digest("hex");
  }
}
Promise.all(Array.from({length:4},worker)).then(()=>fs.writeFileSync(path.join(out,"inventory.json"),JSON.stringify(rows,null,2))).catch(e=>{console.error(e);process.exitCode=1});
