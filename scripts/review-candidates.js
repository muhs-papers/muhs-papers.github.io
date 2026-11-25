// Diagnostic only: printed header evidence, never filename-derived exam metadata.
// Output: source ordinal, then page:season/year/part indicators; '?' needs review.
const fs = require("fs"), path = require("path");
const dir = process.argv[2];
const rows = JSON.parse(fs.readFileSync(path.join(dir,"inventory.json")));
const subjectNames = {
  anatomy:"anatomy",physiology:"physiology",biochemistry:"biochem\\w+",pathology:"pathology",microbiology:"microbiology",
  pharmacology:"(?:pharmacology|therapeutics)",forensic:"toxicology",community:"community medicine",
  ent:"otorhinolaryngology|e\\.n\\.t",ophthalmology:"op[h]?thalmology",obgyn:"gyn[a-z]+ology",
  pediatrics:"pa?ediatrics",surgery:"surgery",medicine:"(?:general medicine|allied sub[j]?ects?)"
};
const proofs=[];
rows.forEach((r,i)=>{
  const header=p=>fs.readFileSync(path.join(dir,"headers",`${r.id}-${p}.txt`),"utf8").split(/\r?\n/).slice(1).join("\n");
  const pages=Number(fs.readFileSync(path.join(dir,"headers",`${r.id}-1.txt`),"utf8").match(/ of (\d+)/)[1]);
  const evidence=[];
  for(let page=1;page<=pages;page++){
    const h=header(page),flat=h.replace(/\s+/g," ");
    const dates=[...flat.matchAll(/\b(summer|winter)[\s,:'’–\-]*(?:\(\s*phase[^)]{0,12}\)\s*)?(20\d{2})/gi)].map(m=>m[1][0].toUpperCase()+m[2]);
    const part=h.match(new RegExp(`(?:${subjectNames[r.subject]})[ \\t_:–-]*\\(?[ \\t]*(?:paper[ \\t-]*)?([iIl1]{1,2}|2)\\b`,"i"))
      ||h.match(/(?:\bpaper[ \t–_-]*|\d{4,}-P)([il1]{1,2}|2)\b/i);
    const isHeader=/examin|question booklet version|Max\. Marks|Total Duration/i.test(h);
    if(dates.length || isHeader || page===1) evidence.push({page,dates:[...new Set(dates)],part:part?(part[1].length===2||part[1]==="2"?2:1):null,header:isHeader});
  }
  proofs.push({i,id:r.id,subject:r.subject,pages,evidence});
  if(!process.argv[3]||r.subject===process.argv[3])console.log(`${i} ${r.subject} ${pages}p ${r.name} | `+
    evidence.map(e=>`${e.page}:${e.dates.join("+")||"?"}/${e.part||"-"}`).join(" "));
});
fs.writeFileSync(path.join(dir,"candidates.json"),JSON.stringify(proofs,null,2));
