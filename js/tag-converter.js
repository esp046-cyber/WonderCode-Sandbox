const TagTools={
  extract(code){const s=new Set(),r=/\b(?:Me\.)?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\b|\b[A-Z]{2,5}_\d{2,4}\w*\b/g;let m;
    const t=code.replace(/"[^"]*"|\/\/.*|\{[^}]*\}/g,' ');while(m=r.exec(t))s.add(m[0]);return [...s]},
  toSP(code){return code.replace(/(^|[^\w."])([A-Z]{2,5}_\d{2,4}\w*(?:\.\w+)?)/g,'$1Me.$2')},
  toInTouch(code){return code.replace(/\bMe\./g,'')}
  ,
  // InTouch QuickScript -> ArchestrA C# (comments, IF/ENDIF, operators, DIM, Me. prefix)
  qsToCs(code){
    const cm=[],tags=Sim.analyze(code,'qs').tags;
    const cond=x=>x.replace(/<>/g,'!=').replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||').replace(/\bNOT\b/gi,'!').replace(/(?<![<>!=:])=(?!=)/g,'==');
    let c=code.replace(/\{([^}]*)\}/g,(m,x)=>'\u0003'+(cm.push(x.split('\n').map(l=>'// '+l.trim()).join('\n'))-1)+'\u0003')
      .replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi,(m,x)=>'if ('+cond(x.trim())+') {').replace(/\bELSE\b/gi,'} else {').replace(/\bENDIF\b\s*;?/gi,'}')
      .replace(/:=/g,'=').replace(/<>/g,'!=').replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||').replace(/\bNOT\b/gi,'!')
      .replace(/\bDIM\s+(\w+)\s+AS\s+(\w+)\s*;/gi,(m,n,t)=>(({INTEGER:'int',REAL:'double',DISCRETE:'bool',MESSAGE:'string'})[t.toUpperCase()]||'double')+' '+n+';');
    [...tags].sort((a,b)=>b.length-a.length).forEach(t=>{c=c.replace(new RegExp('(?<![\\w."])'+t.replace(/\./g,'\\.')+'(?!\\w)','g'),'Me.'+t)});
    return c.replace(/\u0003(\d+)\u0003/g,(m,i)=>cm[i]);
  },
  // ArchestrA C# -> InTouch QuickScript (comments, if/}, operators, declarations, no Me.)
  csToQs(code){
    const cm=[],cond=x=>x.replace(/&&/g,' AND ').replace(/\|\|/g,' OR ').replace(/!=/g,'<>').replace(/!(?!=)/g,'NOT ');
    let c=code.replace(/\bMe\./g,'').replace(/\/\/(.*)$/gm,(m,x)=>'\u0003'+(cm.push('{'+x+' }')-1)+'\u0003');
    const warn=/Math\.|\?[^:\n]*:/.test(c)?'{ Review: Math.* and ?: have no QuickScript translation }\n':'';
    c=c.replace(/\bif\s*\(([^\n]*)\)\s*\{/g,(m,x)=>'IF '+cond(x.trim())+' THEN').replace(/\}\s*else\s*\{/g,'ELSE').replace(/\}/g,'ENDIF;');
    c=cond(c).replace(/\b(double|float|int|bool|var)\s+(\w+)\s*=/g,(m,t,n)=>`DIM ${n} AS ${t==='int'?'INTEGER':t==='bool'?'DISCRETE':'REAL'};\n${n} =`)
      .replace(/([\w.]+)\s*([+-])=\s*([^;]+);/g,'$1 = $1 $2 ($3);').replace(/\btrue\b/g,'1').replace(/\bfalse\b/g,'0');
    return warn+c.replace(/\u0003(\d+)\u0003/g,(m,i)=>cm[i]);
  }
};

// ---- PLC exporter: QuickScript / ArchestrA C# -> Siemens SCL, Rockwell ST, Modbus CSV ----
const PLC=(()=>{
  const TY={BOOL:'Bool',REAL:'Real',DINT:'DInt'},D={INTEGER:'DINT',REAL:'REAL',DISCRETE:'BOOL'};
  const kind=t=>tagKind(t)==='digital'?'BOOL':'REAL',nm=t=>t.replace(/\./g,'_');
  function body(code,lang,tgt,a){
    const cm=[],loc={},warn=new Set,save=s=>'\u0003'+(cm.push(s)-1)+'\u0003';
    let c=code;if(lang==='qs')c=c.replace(/\{([^}]*)\}/g,(m,x)=>save('(*'+x+'*)'));
    c=c.replace(/\/\/.*/g,save).replace(/\bMe\./g,'');
    c=c.replace(/([\w.]+)\s*(\+?=)\s*([^?;]+?)\?([^:;]+):([^;]+);/g,'IF $3 THEN $1 $2 $4; ELSE $1 $2 $5; ENDIF;');
    c=c.replace(/\b(double|int|bool|float|var)\s+(\w+)\s*=/g,(m,t,n)=>{loc[n]=t==='bool'?'BOOL':'REAL';return n+' ='})
       .replace(/\bDIM\s+(\w+)\s+AS\s+(\w+)\s*;?/gi,(m,n,t)=>{loc[n]=D[t.toUpperCase()]||'REAL';return ''});
    if(lang==='cs')c=c.replace(/\bif\s*\(([^\n]*)\)\s*\{/g,'IF $1 THEN').replace(/\}\s*else\s*\{/g,'ELSE').replace(/\}/g,'END_IF;').replace(/\btrue\b/g,'TRUE').replace(/\bfalse\b/g,'FALSE');
    c=c.replace(/\bENDIF\b/gi,'END_IF').replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi,(m,x)=>'IF'+x.replace(/==|(?<![<>!=:])=(?!=)/g,'\u0001')+'THEN')
       .replace(/&&/g,' AND ').replace(/\|\|/g,' OR ').replace(/!=/g,'<>').replace(/!(?!=)/g,'NOT ')
       .replace(/([\w.]+)\s*([+-])=\s*([^;]+);/g,'$1 := $1 $2 ($3);').replace(/==/g,'\u0001').replace(/(?<![<>:=])=(?!=)/g,':=').replace(/\u0001/g,'=');
    c=c.replace(/Math\.PI\b/g,'3.14159265').replace(/Math\.Pow\(([^,]+),([^)]+)\)/g,tgt==='scl'?'EXPT($1,$2)':'(($1) ** ($2))')
       .replace(/Math\.(Max|Min|Abs)\(/g,(m,f)=>{if(tgt==='st'&&f!=='Abs')warn.add('MAX/MIN: use LIM/compare logic in Logix');return f.toUpperCase()+'('});
    [...a.tags].sort((x,y)=>y.length-x.length).forEach(t=>{c=c.replace(new RegExp('(?<![\\w."#])'+t.replace(/\./g,'\\.')+'(?!\\w)','g'),tgt==='scl'?'#'+nm(t):t)});
    if(tgt==='scl')Object.keys(loc).forEach(n=>{c=c.replace(new RegExp('(?<![\\w#])'+n+'(?!\\w)','g'),'#'+n)});
    (c.match(/Math\.\w+/g)||[]).forEach(m=>warn.add(m+' has no direct equivalent'));
    return {text:c.replace(/\u0003(\d+)\u0003/g,(m,i)=>cm[i]).replace(/^\s*\n/gm,'').trim(),loc,warn:[...warn]};
  }
  function csv(a){
    let coil=1,di=10001,ir=30001,hr=40001;const rows=[['Tag','ArchestrA','Direction','DataType','Table','ModbusAddress','Offset','Registers','Scaling','Note']];
    a.tags.forEach(t=>{const o=a.outputs.has(t),d=kind(t)==='BOOL';let tb,ad,n;
      if(d){tb=o?'Coil':'Discrete Input';ad=o?coil++:di++;n=1}else{tb=o?'Holding Register':'Input Register';n=2;ad=o?hr:ir;if(o)hr+=2;else ir+=2}
      rows.push([t,'Me.'+t,o?'Output (PLC->SCADA)':'Input (SCADA->PLC)',d?'BOOL':'FLOAT32',tb,ad,ad-({'Coil':1,'Discrete Input':10001,'Input Register':30001,'Holding Register':40001})[tb],n,d?'':'1.0 (word order CDAB/ABCD per PLC)',''])});
    return rows.map(r=>r.map(x=>/[,"]/.test(x)?'"'+String(x).replace(/"/g,'""')+'"':x).join(',')).join('\n');
  }
  function convert(code,lang,tgt){
    if(lang==='sql')return {text:'-- SQL cannot be exported to a PLC.',ext:'txt',mime:'text/plain'};
    const a=Sim.analyze(code,lang);
    if(tgt==='csv')return {text:csv(a),ext:'csv',mime:'text/csv'};
    const b=body(code,lang,tgt,a),dec=(arr,f)=>arr.map(f).join('\n'),ins=a.tags.filter(t=>!a.outputs.has(t)),outs=a.tags.filter(t=>a.outputs.has(t));
    const rev=`(* REVIEW before download: BOOL vs 0/1 literals, scan time (1 s assumed), units.${b.warn.length?' '+b.warn.join('; ')+'.':''} *)`;
    if(tgt==='scl')return {ext:'scl',mime:'text/plain',text:`(* WonderCode export: SCL for TIA Portal (S7-1200/1500/400FH) *)\n${rev}\nFUNCTION_BLOCK "FB_WonderCode"\nVAR_INPUT\n${dec(ins,t=>`  ${nm(t)} : ${TY[kind(t)]};`)}\nEND_VAR\nVAR_OUTPUT\n${dec(outs,t=>`  ${nm(t)} : ${TY[kind(t)]};`)}\nEND_VAR\nVAR_TEMP\n${dec(Object.keys(b.loc),n=>`  ${n} : ${TY[b.loc[n]]};`)}\nEND_VAR\nBEGIN\n${b.text}\nEND_FUNCTION_BLOCK`};
    return {ext:'st',mime:'text/plain',text:`(* WonderCode export: Studio 5000 Structured Text routine *)\n${rev}\n(* Create these tags (dotted names = UDT members): *)\n${dec(a.tags,t=>`//   ${t} : ${kind(t)}  (${a.outputs.has(t)?'output':'input'})`)}\n${dec(Object.keys(b.loc),n=>`//   ${n} : ${b.loc[n]}  (local)`)}\n\n${b.text}`};
  }
  return {convert};
})();
