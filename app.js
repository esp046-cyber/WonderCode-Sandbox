const $=s=>document.querySelector(s),ta=$('#code'),hl=$('#hl');
let S=DB.get('state',{tabs:[{id:1,name:'script1',lang:'qs',code:'{ Start here or pick a template }\n'}],cur:1});
const cur=()=>S.tabs.find(t=>t.id===S.cur)||S.tabs[0],save=()=>{DB.set('state',S);$('#status').textContent='Saved '+new Date().toLocaleTimeString()};
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function highlight(){const t=cur();let h=esc(ta.value);
  h=h.replace(/(\/\/.*|\{[^}]*\})|("[^"]*"|'[^']*')|\b(IF|THEN|ELSE|ENDIF|WHILE|ENDWHILE|FOR|TO|NEXT|DIM|AS|SELECT|FROM|WHERE|GROUP BY|ORDER BY|AND|OR|NOT|double|int|var|if|else|while|return|new|Math|Me|Show|Hide)\b|\b(\d+\.?\d*)\b/g,
   (m,c,s,k,n)=>c?`<span class=c>${c}</span>`:s?`<span class=s>${s}</span>`:k?`<span class=k>${k}</span>`:`<span class=n>${n}</span>`);
  hl.innerHTML=h+'\n'}
function render(){const t=cur();$('#tabs').innerHTML='';S.tabs.forEach(x=>{const d=document.createElement('div');d.className='tab'+(x.id===t.id?' on':'');d.textContent=x.name;
  const c=document.createElement('i');c.textContent='×';c.onclick=e=>{e.stopPropagation();if(S.tabs.length>1){S.tabs=S.tabs.filter(y=>y.id!==x.id);S.cur=S.tabs[0].id;render();save()}};
  d.append(c);d.onclick=()=>{S.cur=x.id;render()};d.ondblclick=()=>{x.name=prompt('Rename tab',x.name)||x.name;render();save()};$('#tabs').append(d)});
  ta.value=t.code;$('#lang').value=t.lang;highlight();check()}
function check(){const t=cur(),r=validate(t.code,t.lang);$('#issues').innerHTML=r.length?r.map(i=>`<li class="${i.sev}">Line ${i.line}: ${esc(i.msg)}</li>`).join(''):'<li class="ok">No issues found.</li>';
  const tg=TagTools.extract(t.code);$('#tags').innerHTML=tg.length?tg.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>No tags detected.</li>'}
let timer;ta.oninput=()=>{cur().code=ta.value;highlight();clearTimeout(timer);timer=setTimeout(()=>{check();save()},400)};
ta.onscroll=()=>{hl.scrollTop=ta.scrollTop;hl.scrollLeft=ta.scrollLeft};
ta.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'  ')}};
$('#lang').onchange=e=>{const t=cur(),to=e.target.value,from=t.lang;
  // Only the Me. tag prefix is converted; IF/ENDIF vs if{} syntax is not rewritten.
  if(from==='qs'&&to==='cs'&&confirm('Add Me. prefix to InTouch tags?'))t.code=TagTools.toSP(t.code);
  else if(from==='cs'&&to==='qs'&&confirm('Remove Me. prefix from tags?'))t.code=TagTools.toInTouch(t.code);
  t.lang=to;render();save()};
$('#new').onclick=()=>{const id=Date.now();S.tabs.push({id,name:'script'+(S.tabs.length+1),lang:'qs',code:''});S.cur=id;render();save()};
$('#val').onclick=check;
$('#toSP').onclick=()=>{cur().code=TagTools.toSP(cur().code);render();save()};
$('#toIT').onclick=()=>{cur().code=TagTools.toInTouch(cur().code);render();save()};
$('#exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='wondercode-export.json';a.click()};
$('#imp').onchange=async e=>{const f=e.target.files[0];if(!f)return;const x=await f.text();
  try{const j=JSON.parse(x);if(j.tabs){S=j}else throw 0}catch{const id=Date.now();S.tabs.push({id,name:f.name,lang:'qs',code:x});S.cur=id}render();save()};
const tpl=$('#tpl');let g='';TEMPLATES.forEach(t=>{if(t.g!==g){g=t.g;const s=document.createElement('small');s.textContent=g;tpl.append(s)}
  const b=document.createElement('button');b.textContent=t.n;b.onclick=()=>{const id=Date.now();S.tabs.push({id,name:t.n,lang:t.l,code:t.c});S.cur=id;render();save()};tpl.append(b)});
render();
