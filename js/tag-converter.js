/**
 * WonderCode Sandbox - Tag Extraction, Dialect Translation & PLC Exporter
 * Supports InTouch QuickScript, ArchestrA C#, Historian SQL, Siemens SCL, Rockwell ST, and Modbus CSV.
 */

const SYSTEM_KEYWORDS = new Set([
  'convert', 'todouble', 'toint32', 'toboolean', 'tostring',
  'math', 'pi', 'pow', 'max', 'min', 'abs', 'sign', 'round',
  'console', 'thread', 'sleep', 'datetime', 'timespan',
  'string', 'double', 'int', 'bool', 'float', 'void', 'null',
  'me', 'myengine', 'myplatform'
]);

const isPhysicalTag = (t) => {
  if (!t || typeof t !== 'string') return false;
  const clean = t.replace(/^Me\./i, '').trim();
  const parts = clean.split('.');
  const root = parts[0].toLowerCase();
  const sub = parts[1] ? parts[1].toLowerCase() : '';
  
  if (SYSTEM_KEYWORDS.has(root) || SYSTEM_KEYWORDS.has(sub)) return false;
  if (/^(convert|math|system|console)$/i.test(root)) return false;
  return true;
};

const TagTools = {
  _lang: (c) => (/\b(THEN|ENDIF|ENDWHILE)\b/i.test(c) ? 'qs' : 'cs'),

  extract(code, lang) {
    if (!code || !code.trim()) return [];
    lang = lang || TagTools._lang(code);
    
    const simAnalysis = (typeof Sim !== 'undefined' && Sim.analyze) 
      ? Sim.analyze(code, lang) 
      : { tags: [], outputs: new Set() };

    return simAnalysis.tags
      .filter(isPhysicalTag)
      .map((t) => {
        const raw = t.replace(/^Me\./i, '');
        const escaped = raw.replace(/\./g, '\\.');
        const isArchestrA = new RegExp('(?<![\\w.])Me\\.' + escaped + '(?!\\w)').test(code);
        const shown = isArchestrA ? 'Me.' + raw : raw;

        let resolvedType = 'Real';
        if (typeof tagKind === 'function') {
          const k = tagKind(raw);
          resolvedType = (k === 'digital' || k === 'Discrete') ? 'Discrete' : (k === 'Integer' ? 'Integer' : 'Real');
        } else {
          const isDisc = /(Alarm|Trip|Fault|Interlock|\.Sw$|_Sw$|Slip|Fb$|_Fb$|Status|Auto|Enable|Reset|Open|Close|Start|Stop|Divert|Flush|Complete|Done|Tare_Cmd|Dose_Run|Run_Cmd|Lag_Cmd|\.Cmd$|_Cmd$|Run$|_Close$|_Open$)/i.test(raw);
          resolvedType = isDisc ? 'Discrete' : (/(Timer|Stage|Mode|Count|Phase|Step)/i.test(raw) ? 'Integer' : 'Real');
        }

        const isAssigned = new RegExp('(?<![\\w.])' + (isArchestrA ? 'Me\\.' : '') + escaped + '\\s*(?::=|=(?!=))').test(code);
        const mode = (simAnalysis.outputs && simAnalysis.outputs.has(raw)) || isAssigned ? 'Write' : 'Read';

        return {
          name: shown,
          rawName: raw,
          type: resolvedType,
          mode: mode,
          direction: mode === 'Write' ? 'OUT' : 'IN'
        };
      });
  },

  toSP(code, lang) {
    if (!code) return '';
    lang = lang || TagTools._lang(code);
    const tags = (typeof Sim !== 'undefined' && Sim.analyze) ? Sim.analyze(code, lang).tags : [];
    const keep = [];
    const placeholder = (x) => '\u0003' + (keep.push(x) - 1) + '\u0003';

    let c = code
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, placeholder)
      .replace(/\/\/.*/g, placeholder)
      .replace(/\/\*[\s\S]*?\*\//g, placeholder);

    if (lang === 'qs') {
      c = c.replace(/\{[\s\S]*?\}/g, placeholder);
    }

    [...tags]
      .filter(isPhysicalTag)
      .map((t) => t.replace(/^Me\./i, ''))
      .sort((a, b) => b.length - a.length)
      .forEach((t) => {
        const re = new RegExp('(?<![\\w."#])(?<!Me\\.)' + t.replace(/\./g, '\\.') + '(?!\\w)', 'g');
        c = c.replace(re, 'Me.' + t);
      });

    return c.replace(/\u0003(\d+)\u0003/g, (m, i) => keep[i]);
  },

  toInTouch(code) {
    if (!code) return '';
    return code.replace(/(?<![\w.])Me\./g, '');
  },

  qsToCs(code) {
    if (!code) return '';
    const comments = [];
    const placeholder = (x) => '\u0003' + (comments.push(x) - 1) + '\u0003';

    const convertCond = (str) =>
      str
        .replace(/<>/g, '!=')
        .replace(/\bAND\b/gi, '&&')
        .replace(/\bOR\b/gi, '||')
        .replace(/\bNOT\b/gi, '!')
        .replace(/(?<![<>!=:])=(?!=)/g, '==');

    let c = code.replace(/\{([\s\S]*?)\}/g, (m, x) => {
      const lines = x.split('\n').map((l) => '// ' + l.trim());
      return placeholder(lines.join('\n'));
    });

    c = c
      .replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi, (m, x) => 'if (' + convertCond(x.trim()) + ') {')
      .replace(/\bELSE\b/gi, '} else {')
      .replace(/\bENDIF\b\s*;?/gi, '}')
      .replace(/:=/g, '=')
      .replace(/<>/g, '!=')
      .replace(/\bAND\b/gi, '&&')
      .replace(/\bOR\b/gi, '||')
      .replace(/\bNOT\b/gi, '!')
      .replace(/\bDIM\s+(\w+)\s+AS\s+(\w+)\s*;/gi, (m, n, t) => {
        const types = { INTEGER: 'int', REAL: 'double', DISCRETE: 'bool', MESSAGE: 'string' };
        return (types[t.toUpperCase()] || 'double') + ' ' + n + ';';
      });

    const tags = (typeof Sim !== 'undefined' && Sim.analyze) ? Sim.analyze(code, 'qs').tags : [];
    [...tags]
      .filter(isPhysicalTag)
      .map((t) => t.replace(/^Me\./i, ''))
      .sort((a, b) => b.length - a.length)
      .forEach((t) => {
        const re = new RegExp('(?<![\\w."#])(?<!Me\\.)' + t.replace(/\./g, '\\.') + '(?!\\w)', 'g');
        c = c.replace(re, 'Me.' + t);
      });

    return c.replace(/\u0003(\d+)\u0003/g, (m, i) => comments[i]);
  },

  csToQs(code) {
    if (!code) return '';
    const comments = [];
    const placeholder = (x) => '\u0003' + (comments.push(x) - 1) + '\u0003';

    const convertCond = (str) =>
      str
        .replace(/&&/g, ' AND ')
        .replace(/\|\|/g, ' OR ')
        .replace(/!=/g, ' <> ')
        .replace(/!(?!=)/g, ' NOT ')
        .replace(/==/g, ' = ');

    let c = code
      .replace(/\bMe\./g, '')
      .replace(/\/\/(.*)$/gm, (m, x) => placeholder('{ ' + x.trim() + ' }'))
      .replace(/\/\*([\s\S]*?)\*\//g, (m, x) => placeholder('{ ' + x.trim() + ' }'));

    const warn = /Math\.|\?[^:\n]*:/.test(c)
      ? '{ NOTE: Math functions and ternary (? :) operators require manual QuickScript adjustment }\n'
      : '';

    c = c
      .replace(/\bif\s*\(([^)]+)\)\s*\{/gi, (m, x) => 'IF ' + convertCond(x.trim()) + ' THEN')
      .replace(/\}\s*else\s*\{/gi, 'ELSE')
      .replace(/\}/g, 'ENDIF;')
      .replace(/\b(double|float|int|bool|var)\s+(\w+)\s*=/gi, (m, t, n) => {
        const qsType = t === 'int' ? 'INTEGER' : (t === 'bool' ? 'DISCRETE' : 'REAL');
        return `DIM ${n} AS ${qsType};\n${n} =`;
      })
      .replace(/([\w.]+)\s*([+-])=\s*([^;]+);/g, '$1 = $1 $2 ($3);')
      .replace(/\btrue\b/gi, '1')
      .replace(/\bfalse\b/gi, '0');

    c = convertCond(c);
    c = c.replace(/ELSE\s+ENDIF;/g, 'ELSE');

    return warn + c.replace(/\u0003(\d+)\u0003/g, (m, i) => comments[i]);
  }
};

const PLC = (() => {
  const TY = { BOOL: 'Bool', REAL: 'Real', DINT: 'DInt' };
  const D = { INTEGER: 'DINT', REAL: 'REAL', DISCRETE: 'BOOL' };
  
  const kind = (t) => {
    if (typeof tagKind === 'function') {
      const k = tagKind(t);
      return (k === 'digital' || k === 'Discrete') ? 'BOOL' : (k === 'Integer' ? 'DINT' : 'REAL');
    }
    return /(Alarm|Trip|Fault|Interlock|\.Sw$|_Sw$|Slip|Fb$|Cmd|Close|Open|Run)/i.test(t) ? 'BOOL' : 'REAL';
  };

  const nm = (t) => t.replace(/\./g, '_').replace(/^Me_/i, '');

  function body(code, lang, tgt, a) {
    const comments = [];
    const loc = {};
    const warn = new Set();
    const save = (s) => '\u0003' + (comments.push(s) - 1) + '\u0003';

    let c = code;
    if (lang === 'qs') {
      c = c.replace(/\{([\s\S]*?)\}/g, (m, x) => save('(* ' + x.trim() + ' *)'));
    }
    c = c.replace(/\/\/.*/g, save).replace(/\/\*[\s\S]*?\*\//g, save).replace(/\bMe\./g, '');

    c = c.replace(/([\w.]+)\s*(\+?=)\s*([^?;]+?)\s*\?\s*([^:;]+)\s*:\s*([^;]+);/g, 'IF $3 THEN\n    $1 $2 $4;\nELSE\n    $1 $2 $5;\nEND_IF;');

    c = c
      .replace(/\b(double|float|var)\s+(\w+)\s*=/g, (m, t, n) => { loc[n] = 'REAL'; return n + ' :='; })
      .replace(/\bint\s+(\w+)\s*=/g, (m, n) => { loc[n] = 'DINT'; return n + ' :='; })
      .replace(/\bbool\s+(\w+)\s*=/g, (m, n) => { loc[n] = 'BOOL'; return n + ' :='; })
      .replace(/\bDIM\s+(\w+)\s+AS\s+(\w+)\s*;?/gi, (m, n, t) => { loc[n] = D[t.toUpperCase()] || 'REAL'; return ''; });

    if (lang === 'cs') {
      c = c
        .replace(/\bif\s*\(([^)]+)\)\s*\{/g, 'IF $1 THEN')
        .replace(/\}\s*else\s*\{/g, 'ELSE')
        .replace(/\}/g, 'END_IF;')
        .replace(/\btrue\b/gi, 'TRUE')
        .replace(/\bfalse\b/gi, 'FALSE');
    }

    c = c
      .replace(/\bENDIF\b\s*;?/gi, 'END_IF;')
      .replace(/\bIF\b([\s\S]*?)\bTHEN\b/gi, (m, x) => 'IF ' + x.replace(/==|(?<![<>!=:])=(?!=)/g, '\u0001') + ' THEN')
      .replace(/&&/g, ' AND ')
      .replace(/\|\|/g, ' OR ')
      .replace(/!=/g, ' <> ')
      .replace(/!(?!=)/g, ' NOT ')
      .replace(/([\w.]+)\s*([+-])=\s*([^;]+);/g, '$1 := $1 $2 ($3);')
      .replace(/==/g, '\u0001')
      .replace(/(?<![<>:=])=(?!=)/g, ':=')
      .replace(/\u0001/g, '=');

    c = c
      .replace(/Math\.PI\b/g, '3.14159265')
      .replace(/Math\.Pow\(([^,]+),([^)]+)\)/g, tgt === 'scl' ? 'EXPT($1, $2)' : '(($1) ** ($2))')
      .replace(/Math\.Abs\(([^)]+)\)/g, 'ABS($1)')
      .replace(/Math\.(Max|Min)\(([^,]+),([^)]+)\)/g, (m, fn, p1, p2) => {
        if (tgt === 'st') {
          warn.add('Rockwell ST: Nested MAX/MIN replaced with inline comparison');
          return fn === 'Max' ? `(IF (${p1} > ${p2}) THEN ${p1} ELSE ${p2} END_IF)` : `(IF (${p1} < ${p2}) THEN ${p1} ELSE ${p2} END_IF)`;
        }
        return fn.toUpperCase() + `(${p1}, ${p2})`;
      });

    const cleanTags = [...a.tags].filter(isPhysicalTag).map((t) => t.replace(/^Me\./i, ''));
    cleanTags.sort((x, y) => y.length - x.length).forEach((t) => {
      const re = new RegExp('(?<![\\w."#])' + t.replace(/\./g, '\\.') + '(?!\\w)', 'g');
      c = c.replace(re, tgt === 'scl' ? '#' + nm(t) : nm(t));
    });

    if (tgt === 'scl') {
      Object.keys(loc).forEach((n) => {
        c = c.replace(new RegExp('(?<![\\w#])' + n + '(?!\\w)', 'g'), '#' + n);
      });
    }

    (c.match(/Math\.\w+/g) || []).forEach((m) => warn.add(`${m} has no direct PLC instruction`));

    return {
      text: c.replace(/\u0003(\d+)\u0003/g, (m, i) => comments[i]).replace(/^\s*\n/gm, '').trim(),
      loc,
      warn: [...warn]
    };
  }

  function csv(a) {
    let coil = 1, di = 10001, ir = 30001, hr = 40001;
    const rows = [
      ['Tag Name', 'ArchestrA Attribute', 'Direction', 'Data Type', 'Modbus Table', 'Address', 'Zero-Based Offset', 'Length (Words)', 'Byte Order / Scaling']
    ];

    const cleanTags = a.tags.filter(isPhysicalTag);
    cleanTags.forEach((t) => {
      const raw = t.replace(/^Me\./i, '');
      const isOut = a.outputs.has(raw);
      const isBool = kind(raw) === 'BOOL';
      let table, addr, words;

      if (isBool) {
        table = isOut ? 'Coil (0x)' : 'Discrete Input (1x)';
        addr = isOut ? coil++ : di++;
        words = 1;
      } else {
        table = isOut ? 'Holding Register (4x)' : 'Input Register (3x)';
        words = 2;
        addr = isOut ? hr : ir;
        if (isOut) hr += 2; else ir += 2;
      }

      const offset = addr - ({ 'Coil (0x)': 1, 'Discrete Input (1x)': 10001, 'Input Register (3x)': 30001, 'Holding Register (4x)': 40001 }[table]);

      rows.push([
        nm(raw),
        'Me.' + raw,
        isOut ? 'Output (PLC to SCADA)' : 'Input (SCADA to PLC)',
        isBool ? 'BOOL' : 'FLOAT32 (Real)',
        table,
        addr,
        offset,
        words,
        isBool ? 'Standard Bit' : 'CDAB (Word Swapped)'
      ]);
    });

    return rows.map((r) => r.map((x) => (/[",\n]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x)).join(',')).join('\n');
  }

  function convert(code, lang, tgt) {
    if (lang === 'sql') {
      return { text: '-- Historian SQL cannot be compiled to PLC logic.\n-- Use QuickScript or C# to export PLC blocks.', ext: 'txt', mime: 'text/plain' };
    }

    const a = (typeof Sim !== 'undefined' && Sim.analyze) ? Sim.analyze(code, lang) : { tags: [], outputs: new Set() };

    if (tgt === 'csv') {
      return { text: csv(a), ext: 'csv', mime: 'text/csv' };
    }

    const b = body(code, lang, tgt, a);
    const dec = (arr, fn) => arr.map(fn).join('\n');
    const validTags = a.tags.filter(isPhysicalTag).map((t) => t.replace(/^Me\./i, ''));
    const ins = validTags.filter((t) => !a.outputs.has(t));
    const outs = validTags.filter((t) => a.outputs.has(t));

    const warnBlock = b.warn.length ? `\n// WARNING: ${b.warn.join('; ')}\n` : '';

    if (tgt === 'scl') {
      return {
        ext: 'scl',
        mime: 'text/plain',
        text: `(* =========================================================================
   WonderCode Export: Siemens TIA Portal SCL (S7-1200 / S7-1500)
   Generated on ${new Date().toLocaleDateString()}
   ========================================================================= *)${warnBlock}
FUNCTION_BLOCK "FB_WonderCode_Logic"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 0.1
VAR_INPUT
${dec(ins, (t) => `    ${nm(t)} : ${TY[kind(t)]}; // Process Input`)}
END_VAR
VAR_OUTPUT
${dec(outs, (t) => `    ${nm(t)} : ${TY[kind(t)]}; // Process Output / Actuator`)}
END_VAR
VAR_TEMP
${dec(Object.keys(b.loc), (n) => `    ${n} : ${TY[b.loc[n]]}; // Internal Calculation Temp`)}
END_VAR

BEGIN
${b.text}
END_FUNCTION_BLOCK`
      };
    }

    return {
      ext: 'st',
      mime: 'text/plain',
      text: `(* =========================================================================
   WonderCode Export: Rockwell Studio 5000 Logix Designer (Structured Text)
   Generated on ${new Date().toLocaleDateString()}
   ========================================================================= *)${warnBlock}
// --- REQUIRED CONTROLLER TAGS ---
// Inputs:
${dec(ins, (t) => `//   ${nm(t)} : ${kind(t)} (Controller Tag - Input)`)}
// Outputs:
${dec(outs, (t) => `//   ${nm(t)} : ${kind(t)} (Controller Tag - Output)`)}
${Object.keys(b.loc).length ? '// Locals:\n' + dec(Object.keys(b.loc), (n) => `//   ${n} : ${b.loc[n]} (Routine Local)`) : ''}

// --- LOGIC ROUTINE ---
${b.text}`
    };
  }

  return { convert };
})();

(function () {
  const sqlTags = (c) => [...new Set((c.match(/'([\w.]+)'/g) || []).map((x) => x.slice(1, -1)))];

  const toSql = (tags, src) => {
    const validTags = tags.filter(isPhysicalTag).map((t) => t.replace(/^Me\./i, ''));
    return validTags.length
      ? `-- Generated Historian Query for ${src} tags\nSELECT DateTime, TagName, Value, Quality\nFROM History\nWHERE TagName IN (${validTags.map((t) => `'${t}'`).join(', ')})\n  AND DateTime >= DATEADD(hh, -24, GETDATE())\nORDER BY DateTime DESC;\n`
      : `-- No tags identified in the ${src} editor to query.\n`;
  };

  const same = (c) => c;

  TagTools.CV = {
    qsqs: same,
    cscs: same,
    sqlsql: same,
    qscs: (c) => TagTools.qsToCs(c),
    csqs: (c) => TagTools.csToQs(c),
    qssql: (c) => toSql((typeof Sim !== 'undefined' ? Sim.analyze(c, 'qs').tags : []), 'InTouch QuickScript'),
    cssql: (c) => toSql((typeof Sim !== 'undefined' ? Sim.analyze(c, 'cs').tags : []), 'ArchestrA C#'),

    sqlqs: (c) => {
      const tags = sqlTags(c);
      if (!tags.length) return '{ No quoted tag names found in SQL. }\n';
      return `{ Reference tags extracted from Historian SQL }\n` +
             tags.map((t) => `{ Tag: ${t} }`).join('\n') +
             `\n\n{ Implement interlock or control logic below }\n`;
    },

    sqlcs: (c) => {
      const tags = sqlTags(c);
      if (!tags.length) return '// No quoted tag names found in SQL.\n';
      return `// Reference tags extracted from Historian SQL\n` +
             tags.map((t) => `// Tag: Me.${t}`).join('\n') +
             `\n// Implement ArchestrA control logic below\n`;
    }
  };
})();
