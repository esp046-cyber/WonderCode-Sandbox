// Mobile drawers and overflow menu for the editor shell.
(function(){const b=document.body,$=s=>document.querySelector(s),close=()=>{b.classList.remove('dl','dr');$('#acts').classList.remove('open');$('#more').setAttribute('aria-expanded','false')};
$('#menuL').onclick=()=>{const o=b.classList.contains('dl');close();if(!o)b.classList.add('dl')};
$('#menuR').onclick=()=>{const o=b.classList.contains('dr');close();if(!o)b.classList.add('dr')};
$('#more').onclick=()=>{const o=$('#acts').classList.toggle('open');b.classList.remove('dl','dr');$('#more').setAttribute('aria-expanded',o)};
$('#scrim').onclick=close;$('#tpl').addEventListener('click',e=>{if(e.target.closest('button'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});})();

// ---- Simulation engine: converts QuickScript / C# to JS and runs it against a tag store ----
const Sim=(()=>{
  const KW=new Set('IF THEN ELSE ENDIF AND OR NOT WHILE ENDWHILE DIM AS INTEGER REAL DISCRETE MESSAGE DOUBLE INT BOOL VAR FLOAT MATH TRUE FALSE LOGMESSAGE INTEGERROUND NULL RETURN STRING DECIMAL LONG CONSOLE SYSTEM SHOW HIDE SHOWWINDOW INFOAPPACTIVE HTGETTIME WSOPTICAL FOR TO NEXT DO NEW'.split(' '));
  const strip=(c,l)=>(l==='qs'?c.replace(/\{[^}]*\}/g,' '):c).replace(/\/\/.*/g,' ').replace(/\bMe\./g,'');
  function analyze(code,lang){
    const c=strip(code,lang).replace(/"[^"]*"/g,'""'),loc=new Set,tags=[];
    c.replace(/\b(?:DIM|double|int|bool|var|float|string|decimal|long)\s+(\w+)/gi,(m,n)=>loc.add(n));
    c.replace(/(?<![\w.])[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g,m=>{const f=m.split('.')[0];if(!KW.has(f.toUpperCase())&&!loc.has(f)&&!tags.includes(m))tags.push(m)});
    const w=lang==='qs'?c.replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi,(m,x)=>'IF'+x.replace(/=/g,'~')+'THEN'):c;
    const outputs=new Set(tags.filter(t=>new RegExp('(?<![\\w.])'+t.replace(/\./g,'\\.')+'\\s*(?::=|[-+]=|=(?!=))').test(w)));
    return {tags,outputs,locals:loc};
  }
  function toJS(code,lang,tags){
    let c=strip(code,lang);
    [...tags].sort((a,b)=>b.length-a.length).forEach(t=>{c=c.replace(new RegExp('(?<![\\w."])'+t.replace(/\./g,'\\.')+'(?!\\w)','g'),`T["${t}"]`)});
    if(lang==='qs')c=c.replace(/:=/g,'=').replace(/<>/g,'!==').replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||').replace(/\bNOT\b/gi,'!')
      .replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi,(m,x)=>'if('+x.replace(/(?<![<>!=])=(?!=)/g,'==')+'){').replace(/\bELSE\b/gi,'}else{').replace(/\bENDIF\b\s*;?/gi,'}')
      .replace(/\bDIM\s+(\w+)\s+AS\s+\w+/gi,'let $1');
    const M={Pow:'pow',Max:'max',Min:'min',Abs:'abs',Sign:'sign',Round:'round',Floor:'floor',Ceiling:'ceil',Sqrt:'sqrt'};
    return c.replace(/\b(?:double|int|bool|float|string|decimal|long)\s+(\w+)/g,'let $1').replace(/Math\.(Pow|Max|Min|Abs|Sign|Round|Floor|Ceiling|Sqrt)\b/g,(m,n)=>'Math.'+M[n]);
  }
  return {analyze,toJS};
})();

// ---- Simulator UI: sliders, signal generators, fault toggles, timestamped log ----
(function(){
  const $=s=>document.querySelector(s),logEl=$('#log');let timer=null,sess=null,LOG=[],pend=null;
  const show=()=>{logEl.textContent=LOG.join('\n');logEl.scrollTop=logEl.scrollHeight};
  const L=m=>{LOG.push(`[${new Date().toLocaleTimeString([],{hour12:false})}] ${m}`);if(LOG.length>100)LOG.splice(0,LOG.length-100);show()};
  const W=m=>{if(pend){L(pend);pend=null}L(m)};   // scan header is logged only when a scan changes something
  const stop=()=>{clearInterval(timer);timer=null;$('#run').textContent='Simulate'};
  function build(){
    const t=cur(),a=Sim.analyze(t.code,t.lang),box=$('#sim'),s={id:t.id,code:t.code,V:{},G:{},ui:{},n:0,fn:null,err:null};box.innerHTML='';
    s.ins=a.tags.filter(x=>!a.outputs.has(x));s.outs=a.tags.filter(x=>a.outputs.has(x));
    a.tags.forEach(x=>s.V[x]=0);s.ins.forEach(x=>{if(tagKind(x)==='analog')s.V[x]=50});
    s.T=new Proxy(s.V,{get:(o,k)=>o[k]??0,set:(o,k,v)=>{v=typeof v==='boolean'?+v:v;const f=typeof v==='number'?+v.toFixed(3):v;if(o[k]!==v)W(`WRITE Me.${k} = ${f}`);o[k]=v;return true}});
    if(t.lang==='sql'){s.err='SQL scripts cannot be simulated.';return s}
    const er=validate(t.code,t.lang).filter(i=>i.sev==='error');
    if(er.length)s.err=`Blocked: ${er.length} validator error(s). Fix them first.`;
    else try{s.fn=new Function('T','LogMessage','IntegerRound',Sim.toJS(t.code,t.lang,a.tags))}catch(x){s.err='Compile error: '+x.message}
    const row=h=>{const d=document.createElement('div');d.className='sr';d.innerHTML=h;box.append(d);return d};
    s.ins.forEach(x=>{
      if(tagKind(x)==='digital'){const d=row(`<label><input type="checkbox"> ${x} <small>(inject)</small></label>`);d.querySelector('input').onchange=e=>{s.V[x]=+e.target.checked;L(`INJECT Me.${x} = ${s.V[x]}`)}}
      else{const d=row(`<div>${x}<b>50</b></div><select aria-label="Generator"><option>Manual</option><option>Sine</option><option>Ramp</option></select><input type="range" min="0" max="100" step="0.5" value="50" aria-label="${x}">`);
        const r=d.querySelector('input'),b=d.querySelector('b');r.oninput=()=>{s.V[x]=+r.value;b.textContent=r.value;L(`SET Me.${x} = ${r.value}`)};
        d.querySelector('select').onchange=e=>{s.G[x]=e.target.value;L(`GEN Me.${x} -> ${e.target.value}`)};s.ui[x]=v=>{r.value=v;b.textContent=v}}});
    s.outs.forEach(x=>{const d=row(`<div>${x} <small>(out)</small><b>0</b></div>`),b=d.querySelector('b');s.ui[x]=v=>b.textContent=typeof v==='number'?+v.toFixed(2):v});
    return s}
  // Called by render() on tab/code change: stops the run, clears sliders and log, re-extracts tags for the active tab.
  window.initSimulator=()=>{stop();LOG=[];pend=null;show();sess=build()};
  function start(){const t=cur();if(!sess||sess.id!==t.id||sess.code!==t.code)sess=build();const s=sess;if(s.err)return L(s.err);
    const tick=()=>{s.n++;s.ins.forEach(x=>{const m=s.G[x];if(m&&m!=='Manual'){s.V[x]=+(m==='Sine'?50+50*Math.sin(s.n/5):(s.n*5)%100).toFixed(1);s.ui[x](s.V[x])}});
      pend=`--- SCAN #${s.n} ---`;try{s.fn(s.T,m=>W('MSG '+m),Math.round)}catch(e){L('Runtime error: '+e.message);stop();return}s.outs.forEach(x=>s.ui[x](s.V[x]))};
    $('#run').textContent='Stop';document.body.classList.add('dr');tick();timer=setInterval(tick,1000)}
  $('#run').onclick=()=>timer?(stop(),L('Stopped.')):start();
  $('#logClear').onclick=()=>{LOG=[];pend=null;show()};

  // PLC exporter dialog
  const dlg=$('#plcDlg'),out=$('#plcOut');let R={text:'',ext:'txt',mime:'text/plain'};
  const gen=()=>{const t=cur();R=PLC.convert(t.code,t.lang,$('#plcT').value);out.textContent=R.text};
  $('#plcBtn').onclick=()=>{$('#acts').classList.remove('open');gen();dlg.showModal()};$('#plcT').onchange=gen;$('#plcX').onclick=()=>dlg.close();
  $('#plcCopy').onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(out.textContent);
})();

// ---- Tab management: unique names, close confirmation, undo toast ----
const uniq=(n,skip)=>{const x=S.tabs.filter(t=>t.id!==skip).map(t=>t.name);if(!x.includes(n))return n;let i=1;while(x.includes(`${n} (${i})`))i++;return `${n} (${i})`};
const isEdited=t=>t.code.trim()!==''&&t.code!==(t.orig??'');
function addTab(name,lang,code){const id=Date.now();S.tabs.push({id,name:uniq(name),lang,code,orig:code});S.cur=id;render();save()}
let toastT;function toast(msg,label,fn){const t=document.getElementById('toast');t.innerHTML='';const s=document.createElement('span');s.textContent=msg;t.append(s);
  if(label){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();t.hidden=true};t.append(b)}t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,7000)}
function closeTab(id){if(S.tabs.length<2)return toast('Cannot close the last tab.');const i=S.tabs.findIndex(x=>x.id===id),t=S.tabs[i];
  if(isEdited(t)&&!confirm(`"${t.name}" has edits. Close it anyway?`))return;
  S.tabs.splice(i,1);if(S.cur===id)S.cur=S.tabs[Math.min(i,S.tabs.length-1)].id;render();save();
  toast(`Closed "${t.name}"`,'Undo',()=>{S.tabs.splice(i,0,t);S.cur=t.id;render();save()})}

// ---- Language dropdown: convert / load starter / keep text ----
(function(){
  const $=s=>document.querySelector(s),dlg=$('#langDlg'),LN={qs:'QuickScript',cs:'C#',sql:'SQL'};let to=null;
  $('#lang').onchange=e=>{const t=cur();to=e.target.value;if(to===t.lang)return;
    if(!t.code.trim()){t.lang=to;render();save();return}
    $('#langMsg').textContent=`Switch this tab from ${LN[t.lang]} to ${LN[to]}? Your code is not rewritten unless you choose to.`;
    dlg.showModal()};
  $('#lcv').onclick=()=>{const t=cur(),fn=(TagTools.CV||{})[t.lang+to];let out=t.code;
    try{
      if(typeof fn==='function')out=fn(t.code);
      else if(to==='cs')out=TagTools.toSP(t.code);          // fallback: tag prefix only
      else if(to==='qs')out=TagTools.toInTouch(t.code);
    }catch(err){toast('Conversion failed: '+err.message)}
    t.code=out;t.lang=to;save();dlg.close()};   // close -> render() refreshes editor and re-validates
  $('#ltp').onclick=()=>{const p=TEMPLATES.find(x=>x.l===to);dlg.close();if(p)addTab(p.n,p.l,p.c)};
  $('#lkeep').onclick=()=>{cur().lang=to;dlg.close();save()};
  $('#lcancel').onclick=()=>dlg.close();
  dlg.addEventListener('close',()=>render());
})();
