/**
 * Industrial SCADA Script Validator & Tag Classifier
 * InTouch QuickScript, ArchestrA C#, and Historian SQL
 */

// Universal Tag Classifier for Industrial Automation
function tagKind(n) {
  if (!n || typeof n !== 'string') return 'Real';

  const clean = n.replace(/^Me\./i, '').trim();

  // 1. ANALOG SETPOINTS & PROCESS VALUES OVERRIDE (Always Real)
  if (/_SP$|\.SP$|_PV$|\.PV$|Level|Temp|Flow|Speed|Weight|Volume|Diameter|Pressure|Press|kW|Rate/i.test(clean)) {
    return 'Real';
  }

  // 2. DISCRETE (Digital / Boolean: 0 or 1, True or False)
  const isDiscrete = /(Alarm|Trip|Fault|Interlock|\.Sw$|_Sw$|Slip|Fb$|_Fb$|Status|Auto|Enable|Reset|Open|Close|Start|Stop|Divert|Flush|Complete|Done|Tare_Cmd|Dose_Run|Run_Cmd|Lag_Cmd|\.Cmd$|_Cmd$|Run$|_Close$|_Open$)/i.test(clean);
  if (isDiscrete) return 'Discrete';

  // 3. INTEGER (Whole Numbers: Step sequencers, stages, quality codes, timers)
  const isInteger = /(Timer|Stage|Mode|Count|Phase|Step|Quality|_Sec$)/i.test(clean);
  if (isInteger) return 'Integer';

  return 'Real';
}

// Friendly dialect check with non-coder explanations
function detectDialect(code, lang) {
  if (!code || !code.trim()) return null;

  // Strip comments and strings before evaluating syntax
  const cleanCode = code
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  if (lang === 'cs') {
    // QuickScript-exclusive block terminators inside C# mode
    if (/\b(THEN|ENDIF|ENDWHILE)\b/i.test(cleanCode)) {
      return {
        title: 'Wrong Language Mode Selected',
        tip: 'This script contains QuickScript keywords (like "THEN" or "ENDIF"). Switch the language dropdown to "QuickScript".'
      };
    }
  }

  if (lang === 'qs') {
    // FIXED: Only flag true C# syntax (typed declarations or if (...) { with curly brace), NOT QuickScript IF (...) THEN
    const hasCSharpKeywords = /\b(?:double|float|int|bool|string|var)\s+[A-Za-z_]\w*\s*=/i.test(cleanCode);
    const hasCSharpIfBrace = /\bif\s*\([^)]+\)\s*\{/i.test(cleanCode);
    const hasMathNamespace = /\bMath\.(Pow|Max|Min|Abs|Round|Sign|PI)\b/.test(cleanCode);

    if (hasCSharpKeywords || hasCSharpIfBrace || hasMathNamespace) {
      return {
        title: 'Wrong Language Mode Selected',
        tip: 'This script contains C# code (e.g., "double", "Math.", or "if () {"). Switch the language dropdown above to "C#".'
      };
    }
  }

  return null;
}

// Main SCADA Code Validator
function validate(code, lang) {
  const out = [];
  const lines = code.split('\n');

  const add = (lineNum, sev, title, tip, fix = '') => {
    out.push({
      line: lineNum,
      sev: sev,
      msg: title,
      tip: tip,
      fix: fix
    });
  };

  if (!code.trim()) {
    add(1, 'info', 'Sandbox is Empty', 'Select an AGAC template from the left sidebar to load an industrial process routine.');
    return out;
  }

  const dialectCheck = detectDialect(code, lang);
  if (dialectCheck) {
    add(1, 'warn', dialectCheck.title, dialectCheck.tip);
  }

  const sanitizedCode = code
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  const countPattern = (regex) => (sanitizedCode.match(regex) || []).length;

  // 1. INTOUCH QUICKSCRIPT VALIDATION
  if (lang === 'qs') {
    const ifCount = countPattern(/\bIF\b/gi);
    const endifCount = countPattern(/\bENDIF\b/gi);
    if (ifCount !== endifCount) {
      add(
        1,
        'error',
        `Unclosed Logic Block (${ifCount} IF vs ${endifCount} ENDIF)`,
        `In QuickScript, every IF statement requires an ENDIF;. You have ${Math.abs(ifCount - endifCount)} missing closure(s).`,
        'Add ENDIF; at the end of the conditional logic block.'
      );
    }

    const whileCount = countPattern(/\bWHILE\b/gi);
    const endwhileCount = countPattern(/\bENDWHILE\b/gi);
    if (whileCount !== endwhileCount) {
      add(
        1,
        'error',
        `Unclosed Loop (${whileCount} WHILE vs ${endwhileCount} ENDWHILE)`,
        'Ensure every WHILE loop has a closing ENDWHILE; statement.',
        'Add ENDWHILE; at the end of the loop.'
      );
    }

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      let line = rawLine.trim();

      if (!line || line.startsWith('{') || line.startsWith('//')) return;
      line = line.replace(/\{[^}]*\}$/, '').replace(/\/\/.*$/, '').trim();
      if (!line) return;

      if (/^\s*IF\b/i.test(line) && !/\bTHEN\b/i.test(line)) {
        add(
          lineNum,
          'error',
          'Missing "THEN" in condition',
          'QuickScript conditions must end with THEN. Format: IF [Condition] THEN',
          'Add THEN after your condition.'
        );
      }

      if (/\bWHILE\s+(1|TRUE|-1)\b/i.test(line)) {
        add(
          lineNum,
          'error',
          'Dangerous Infinite Loop Detected',
          'A WHILE 1 or WHILE TRUE loop will freeze the Wonderware InTouch View engine. Use an asynchronous condition script instead.'
        );
      }

      if (/\b(Show|Hide|ShowWindow)\s+[^"\s;]/i.test(line)) {
        add(
          lineNum,
          'error',
          'Unquoted Window Name',
          'InTouch window screen names must be enclosed in quotation marks.',
          'Example: Show "Overview_Main";'
        );
      }

      if (/\b[0-9]+[A-Za-z_]\w*/.test(line) && !line.includes('//') && !line.includes('{')) {
        add(
          lineNum,
          'warn',
          'Invalid Tag Naming Convention',
          'SCADA tags cannot start with a numeral. Use an alphabet prefix (e.g., TK_101 instead of 101_TK).'
        );
      }

      const isBlockKeyword = /^(IF|ELSE|ENDIF|WHILE|ENDWHILE|FOR|NEXT)$/i.test(line);
      const endsProperly = /(;|THEN|\{|\})\s*$/.test(line);
      if (!isBlockKeyword && !endsProperly) {
        add(
          lineNum,
          'warn',
          'Missing Semicolon (;)',
          'InTouch QuickScript assignments and statements must end with a semicolon.',
          'Add a semicolon (;) to the end of this line.'
        );
      }
    });

  // 2. ARCHESTRA C# VALIDATION
  } else if (lang === 'cs') {
    const openBraces = countPattern(/\{/g);
    const closeBraces = countPattern(/\}/g);
    if (openBraces !== closeBraces) {
      add(
        1,
        'error',
        `Bracket Mismatch (${openBraces} '{' vs ${closeBraces} '}')`,
        'Every opening curly bracket { must have a matching closing bracket }.',
        'Check that all logic scopes are properly closed.'
      );
    }

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      if (!line || line.startsWith('//') || line.startsWith('/*')) return;

      if (/\bThread\.Sleep\b/.test(line)) {
        add(
          lineNum,
          'warn',
          'Scan Engine Blocker (Thread.Sleep)',
          'Thread.Sleep halts the ArchestrA AppEngine scan thread. Use an asynchronous timer attribute instead.'
        );
      }

      if (/while\s*\(\s*true\s*\)/i.test(line) && !code.includes('break;')) {
        add(
          lineNum,
          'error',
          'Unbreakable while(true) loop',
          'This loop will hang the ArchestrA execution engine because there is no break condition.'
        );
      }

      if (/Me\.\w+(\.\w+)?\s*(\+=|-=|\*=|\/=)/.test(line)) {
        add(
          lineNum,
          'warn',
          'Compound Assignment on Me Attribute',
          'ArchestrA attributes are COM-wrapped primitives. Direct operators like "+=" can cause script compilation errors.',
          'Rewrite as: Me.Tag = Me.Tag + 1;'
        );
      }
    });

  // 3. HISTORIAN SQL VALIDATION
  } else if (lang === 'sql') {
    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      if (/\bSELECT\s+\*/i.test(line)) {
        add(
          lineNum,
          'warn',
          'Inefficient Query (SELECT *)',
          'AVEVA Historian tables contain millions of events. List specific columns (e.g., DateTime, TagName, Value).'
        );
      }
    });

    if (/\bFROM\s+(Live|History|WideHistory)\b/i.test(code) && !/\bWHERE\b/i.test(code)) {
      add(
        1,
        'warn',
        'Missing Time Boundary (No WHERE clause)',
        'Historian queries require a time boundary (e.g., WHERE DateTime >= DATEADD(hh, -24, GETDATE())). Without a filter, the query may time out.'
      );
    }
  }

  return out;
}
