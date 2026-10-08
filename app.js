const $=s=>document.querySelector(s),ta=$('#code'),hl=$('#hl'),D0='{ Start here or pick a template }\n';
let S=DB.get('state',{tabs:[{id:1,name:'script1',lang:'qs',code:D0,orig:D0}],cur:1});
const cur=()=>S.tabs.find(t=>t.id===S.cur)||S.tabs[0],save=()=>{DB.set('state',S);$('#status').textContent='Saved '+new Date().toLocaleTimeString()};
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
function highlight(){let h=esc(ta.value);
  h=h.replace(/(\/\/.*|\{[^}]*\})|("[^"]*"|'[^']*')|\b(IF|THEN|ELSE|ENDIF|WHILE|ENDWHILE|FOR|TO|NEXT|DIM|AS|SELECT|FROM|WHERE|GROUP BY|ORDER BY|AND|OR|NOT|double|int|bool|var|if|else|while|return|new|Math|Me|Show|Hide)\b|\b(\d+\.?\d*)\b/g,
   (m,c,s,k,n)=>c?`<span class=c>${c}</span>`:s?`<span class=s>${s}</span>`:k?`<span class=k>${k}</span>`:`<span class=n>${n}</span>`);hl.innerHTML=h+'\n'}
function render(){const t=cur();$('#tabs').innerHTML='';
  S.tabs.forEach(x=>{const d=document.createElement('div');d.className='tab'+(x.id===t.id?' on':'');d.textContent=x.name;
    const c=document.createElement('i');c.textContent='×';c.setAttribute('aria-label','Close '+x.name);c.onclick=e=>{e.stopPropagation();closeTab(x.id)};
    d.append(c);d.onclick=()=>{S.cur=x.id;render()};d.ondblclick=()=>{const n=prompt('Rename tab',x.name);if(n){x.name=uniq(n,x.id);render();save()}};$('#tabs').append(d)});
  ta.value=t.code;$('#lang').value=t.lang;highlight();check()}
function check(){const t=cur(),r=validate(t.code,t.lang),d=detectDialect(t.code,t.lang);
  $('#badge').hidden=!d;$('#badge').textContent=d?'⚠ '+d:'';
  $('#issues').innerHTML=r.length?r.map(i=>`<li class="${i.sev}">Line ${i.line}: ${esc(i.msg)}</li>`).join(''):'<li class="ok">No issues found.</li>';
  const tg=TagTools.extract(t.code);$('#tags').innerHTML=tg.length?tg.map(x=>`<li>${esc(x)}</li>`).join(''):'<li>No tags detected.</li>'}
let timer;ta.oninput=()=>{cur().code=ta.value;highlight();clearTimeout(timer);timer=setTimeout(()=>{check();save()},400)};
ta.onscroll=()=>{hl.scrollTop=ta.scrollTop;hl.scrollLeft=ta.scrollLeft};
ta.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'  ')}};
$('#new').onclick=()=>addTab('script'+(S.tabs.length+1),'qs','');
$('#val').onclick=check;
$('#toSP').onclick=()=>{cur().code=TagTools.toSP(cur().code);render();save()};
$('#toIT').onclick=()=>{cur().code=TagTools.toInTouch(cur().code);render();save()};
$('#exp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download='wondercode-export.json';a.click()};
$('#imp').onchange=async e=>{const f=e.target.files[0];if(!f)return;const x=await f.text();
  try{const j=JSON.parse(x);if(j.tabs){S=j;render();save()}else throw 0}catch{addTab(f.name,'qs',x)}};
const tpl=$('#tpl');let g='';TEMPLATES.forEach(t=>{if(t.g!==g){g=t.g;const s=document.createElement('small');s.textContent=g;tpl.append(s)}
  const b=document.createElement('button');b.textContent=t.n;b.onclick=()=>addTab(t.n,t.l,t.c);tpl.append(b)});

// iOS: keep the bottom toolbar above the virtual keyboard.
const vv=window.visualViewport;if(vv){const f=()=>document.documentElement.style.setProperty('--kb',Math.max(0,window.innerHeight-vv.height-vv.offsetTop)+'px');
  vv.addEventListener('resize',f);vv.addEventListener('scroll',f);f()}

// Welcome modal + guided tour
const STEPS=[['1/3 · Code templates','Open ☰ (left panel) and pick a template: InTouch QuickScript, ArchestrA C# or Historian SQL. Each opens in its own tab.','#L','dl'],
 ['2/3 · Converter & validator','The right panel (✓) lists validator issues and tags. Change the language dropdown to convert InTouch ↔ ArchestrA, or use the tag buttons.','#R','dr'],
 ['3/3 · Tag simulator','Press Simulate: sliders, Sine/Ramp generators and fault toggles appear for every tag, and the log shows each output write.','#run','']];
let si=0;const W=$('#welcome'),clr=()=>{document.querySelectorAll('.spot').forEach(e=>e.classList.remove('spot'));document.body.classList.remove('dl','dr')};
function step(i){si=i;const s=STEPS[i];clr();if(s[3])document.body.classList.add(s[3]);$(s[2]).classList.add('spot');
  $('#wT').textContent=s[0];$('#wB').textContent=s[1];$('#wPrev').disabled=!i;$('#wNext').textContent=i===2?'Done':'Next'}
$('#wNext').onclick=()=>si===2?W.close():step(si+1);$('#wPrev').onclick=()=>step(si-1);$('#wSkip').onclick=()=>W.close();
W.addEventListener('close',()=>{clr();try{localStorage.setItem('wc_visited','1')}catch{}});
$('#tour').onclick=()=>{clr();W.showModal();step(0)};
render();
try{if(!localStorage.getItem('wc_visited'))$('#tour').click()}catch{}
