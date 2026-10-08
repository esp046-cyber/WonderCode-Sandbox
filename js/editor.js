// Mobile drawers and overflow menu for the editor shell.
(function(){const b=document.body,$=s=>document.querySelector(s),close=()=>{b.classList.remove('dl','dr');$('#acts').classList.remove('open');$('#more').setAttribute('aria-expanded','false')};
$('#menuL').onclick=()=>{const o=b.classList.contains('dl');close();if(!o)b.classList.add('dl')};
$('#menuR').onclick=()=>{const o=b.classList.contains('dr');close();if(!o)b.classList.add('dr')};
$('#more').onclick=()=>{const o=$('#acts').classList.toggle('open');b.classList.remove('dl','dr');$('#more').setAttribute('aria-expanded',o)};
$('#scrim').onclick=close;$('#tpl').addEventListener('click',e=>{if(e.target.closest('button'))close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});})();

// ---- Simulation engine: converts QuickScript / C# to JS and runs it against a tag store ----
const Sim=(()=>{
  const KW=new Set('IF THEN ELSE ENDIF AND OR NOT WHILE ENDWHILE DIM AS INTEGER REAL DISCRETE MESSAGE DOUBLE INT BOOL VAR FLOAT MATH TRUE FALSE LOGMESSAGE INTEGERROUND NULL RETURN'.split(' '));
  const strip=(c,l)=>(l==='qs'?c.replace(/\{[^}]*\}/g,' '):c).replace(/\/\/.*/g,' ').replace(/\bMe\./g,'');
  function analyze(code,lang){
    const c=strip(code,lang).replace(/"[^"]*"/g,'""'),loc=new Set,tags=[];
    c.replace(/\b(?:DIM|double|int|bool|var|float)\s+(\w+)/gi,(m,n)=>loc.add(n));
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
    return c.replace(/\b(?:double|int|bool|float)\s+(\w+)/g,'let $1').replace(/Math\.(Pow|Max|Min|Abs|Sign|Round|Floor|Ceiling|Sqrt)\b/g,(m,n)=>'Math.'+M[n]);
  }
  return {analyze,toJS};
})();

// ---- Simulator UI: sliders, signal generators, fault toggles, timestamped log ----
(function(){
  const $=s=>document.querySelector(s),logEl=$('#log');let timer=null;
  const L=m=>{logEl.textContent+=`[${new Date().toLocaleTimeString([],{hour12:false})}] ${m}\n`;const a=logEl.textContent.split('\n');if(a.length>250)logEl.textContent=a.slice(-200).join('\n');logEl.scrollTop=1e9};
  const stop=()=>{clearInterval(timer);timer=null;$('#run').textContent='Simulate'};
  function start(){
    const t=cur(),a=Sim.analyze(t.code,t.lang),errs=validate(t.code,t.lang).filter(i=>i.sev==='error');logEl.textContent='';
    if(t.lang==='sql')return L('SQL scripts cannot be simulated.');
    if(errs.length)return L(`Blocked: ${errs.length} validator error(s). Fix them first.`);
    let fn;try{fn=new Function('T','LogMessage','IntegerRound',Sim.toJS(t.code,t.lang,a.tags))}catch(e){return L('Compile error: '+e.message)}
    const V={},G={},ui={},box=$('#sim'),ins=a.tags.filter(x=>!a.outputs.has(x)),outs=a.tags.filter(x=>a.outputs.has(x));box.innerHTML='';
    a.tags.forEach(x=>V[x]=0);ins.forEach(x=>{if(tagKind(x)==='analog')V[x]=50});
    const T=new Proxy(V,{get:(o,k)=>o[k]??0,set:(o,k,v)=>{v=typeof v==='boolean'?+v:v;const f=typeof v==='number'?+v.toFixed(3):v;if(o[k]!==v)L(`WRITE Me.${k} = ${f}`);o[k]=v;return true}});
    const row=(h)=>{const d=document.createElement('div');d.className='sr';d.innerHTML=h;box.append(d);return d};
    ins.forEach(x=>{
      if(tagKind(x)==='digital'){const d=row(`<label><input type="checkbox"> ${x} <small>(inject)</small></label>`);d.querySelector('input').onchange=e=>{V[x]=+e.target.checked;L(`INJECT Me.${x} = ${V[x]}`)}}
      else{const d=row(`<div>${x}<b>50</b></div><select aria-label="Generator"><option>Manual</option><option>Sine</option><option>Ramp</option></select><input type="range" min="0" max="100" step="0.5" value="50" aria-label="${x}">`);
        const r=d.querySelector('input'),b=d.querySelector('b');r.oninput=()=>{V[x]=+r.value;b.textContent=r.value;L(`SET Me.${x} = ${r.value}`)};
        d.querySelector('select').onchange=e=>{G[x]=e.target.value;L(`GEN Me.${x} -> ${e.target.value}`)};ui[x]=v=>{r.value=v;b.textContent=v}}});
    outs.forEach(x=>{const d=row(`<div>${x} <small>(out)</small><b>0</b></div>`),b=d.querySelector('b');ui[x]=v=>b.textContent=typeof v==='number'?+v.toFixed(2):v});
    let n=0;const tick=()=>{n++;ins.forEach(x=>{const m=G[x];if(m&&m!=='Manual'){V[x]=+(m==='Sine'?50+50*Math.sin(n/5):(n*5)%100).toFixed(1);ui[x](V[x])}});
      L(`--- SCAN #${n} ---`);try{fn(T,m=>L('MSG '+m),Math.round)}catch(e){L('Runtime error: '+e.message);stop();return}outs.forEach(x=>ui[x](V[x]))};
    $('#run').textContent='Stop';document.body.classList.add('dr');tick();timer=setInterval(tick,1000);
  }
  $('#run').onclick=()=>timer?(stop(),L('Stopped.')):start();

  // PLC exporter dialog
  const dlg=$('#plcDlg'),out=$('#plcOut');let R={text:'',ext:'txt',mime:'text/plain'};
  const gen=()=>{const t=cur();R=PLC.convert(t.code,t.lang,$('#plcT').value);out.textContent=R.text};
  $('#plcBtn').onclick=()=>{$('#acts').classList.remove('open');gen();dlg.showModal()};$('#plcT').onchange=gen;$('#plcX').onclick=()=>dlg.close();
  $('#plcCopy').onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(out.textContent);
  $('#plcDl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([R.text],{type:R.mime}));a.download=cur().name.replace(/\W+/g,'_')+'.'+R.ext;a.click()};
})();
