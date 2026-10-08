// Lint rules for InTouch QuickScript, ArchestrA C# and Historian SQL.
function validate(code,lang){
  const out=[],L=code.split('\n'),add=(i,sev,msg)=>out.push({line:i+1,sev,msg});
  const cnt=r=>(code.match(r)||[]).length;
  if(lang==='qs'){
    const a=cnt(/\bIF\b/gi),b=cnt(/\bENDIF\b/gi);if(a!==b)add(0,'error',`IF/ENDIF mismatch: ${a} IF vs ${b} ENDIF.`);
    const w=cnt(/^\s*WHILE\b/gim),e=cnt(/\bENDWHILE\b/gi);if(w!==e)add(0,'error',`WHILE/ENDWHILE mismatch: ${w} vs ${e}.`);
    L.forEach((l,i)=>{
      if(/^\s*IF\b/i.test(l)&&!/\bTHEN\b/i.test(l))add(i,'error','IF without THEN.');
      if(/\bWHILE\s+(1|TRUE|-1)\b/i.test(l))add(i,'error','Infinite WHILE freezes the HMI; use a condition script instead.');
      if(/\b(Show|Hide|ShowWindow)\s+[^"\s;]/i.test(l))add(i,'error','Window name must be quoted, e.g. Show "Overview";');
      if(/\bInfoAppActive\s*\(\s*\)/i.test(l))add(i,'error','InfoAppActive() needs a quoted application title.');
      if(/\bHTGetTime\s*\(\s*\)/i.test(l))add(i,'warn','HTGetTime() needs a time argument.');
      if(/\bWSOptical\s*\(/i.test(l)&&!/WSOptical\s*\(\s*"/i.test(l))add(i,'warn','WSOptical() expects a quoted string.');
      if(/\b\w+-\d+\w*\./.test(l)||/\b\d+[A-Za-z_]\w*\./.test(l))add(i,'warn','Tag names cannot contain hyphens or start with a digit.');
      if(/^\s*DIM\b/i.test(l)&&!/\bAS\b/i.test(l))add(i,'warn','DIM syntax: DIM name AS type;');
      if(l.trim()&&!/^\s*(\{.*|\/\/.*|ELSE|ENDIF|ENDWHILE)\s*$/i.test(l)&&!/(;|THEN|\})\s*$/i.test(l)&&!/^\s*(WHILE|FOR|NEXT|ELSE)/i.test(l))add(i,'warn','Statement may be missing a semicolon.');
    });
  }else if(lang==='cs'){
    const o=cnt(/{/g),c=cnt(/}/g);if(o!==c)add(0,'error',`Brace mismatch: ${o} { vs ${c} }.`);
    L.forEach((l,i)=>{
      if(/while\s*\(\s*true\s*\)/.test(l)&&!/\bbreak\b/.test(code))add(i,'error','while(true) without break blocks the engine scan.');
      if(/\bThread\.Sleep\b/.test(l))add(i,'warn','Thread.Sleep blocks the script thread.');
      if(/\bMe\.\w+\.\w+\.\w+/.test(l))add(i,'warn','Deep attribute access: check quality/null first.');
    });
  }else{
    L.forEach((l,i)=>{if(/\bSELECT\s+\*/i.test(l))add(i,'warn','SELECT * on Historian tables is slow; list the tags.')});
    if(/\bFROM\s+(Live|History|WideHistory)\b/i.test(code)&&!/\bWHERE\b/i.test(code))add(0,'warn','Historian query without WHERE/time range.');
  }
  if(!code.trim())add(0,'warn','Editor is empty.');
  return out;
}

// Classify a tag as digital (alarms, trips, commands, feedbacks) or analog; drives simulator controls and PLC data types.
function tagKind(n){
  if(/\.PV$|_SP$|Timer|Speed|Stage|Mode|Count|Weight|Phase|Step|Level/i.test(n))return 'analog';
  return /(Alarm|Trip|Fault|Interlock|\.Sw$|Slip|Fb$|Status|Auto|Enable|Reset|Open|Close|Start|Stop|Divert|Flush|Complete|Done|Tare_Cmd|Dose_Run|Run_Cmd|Lag_Cmd|\.Cmd$|Cmd_|Run$)/i.test(n)?'digital':'analog';
}
