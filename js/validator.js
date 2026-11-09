/**
 * Industrial SCADA Script Validator & Tag Classifier
 * InTouch QuickScript, ArchestrA C#, and Historian SQL
 */

// Classify tags into SCADA data types: 'Discrete', 'Real', or 'Integer'
function tagKind(n) {
  if (!n || typeof n !== 'string') return 'Real';

  // Normalize by stripping ArchestrA prefix and clean delimiters
  const clean = n.replace(/^Me\./i, '').trim();

  // 1. DISCRETE (Digital / Boolean: 0 or 1, True or False)
  const isDiscrete = /(Alarm|Trip|Fault|Interlock|\.Sw$|_Sw$|Slip|Fb$|_Fb$|Status|Auto|Enable|Reset|Open|Close|Start|Stop|Divert|Flush|Complete|Done|Tare_Cmd|Dose_Run|Run_Cmd|Lag_Cmd|\.Cmd$|_Cmd$|Run$|_Close$|_Open$)/i.test(clean);
  if (isDiscrete) return 'Discrete';

  // 2. INTEGER (Whole numbers: Timers, Step Sequencers, Modes, Counts, Quality codes)
  const isInteger = /(Timer|Stage|Mode|Count|Phase|Step|Quality|_Sec$)/i.test(clean);
  if (isInteger) return 'Integer';

  // 3. REAL / FLOAT (Analog process variables, setpoints, calculated measurements)
  // Matches LIT, PIT, FIT, TT, AIT, level, temp, speed, strapping volumes
  return 'Real';
}

// Friendly dialect check with non-coder explanations
function detectDialect(code, lang) {
  // Strip comments before checking syntax patterns
  const cleanCode = code
    .replace(/\{[\s\S]*?\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*/g, ' ');

  if (lang === 'cs') {
    if (/\b(THEN|ENDIF|ENDWHILE)\b/i.test(cleanCode)) {
      return {
        title: 'Wrong Language Mode Selected',
        tip: 'This script uses InTouch QuickScript words like "THEN" or "ENDIF". Switch the top dropdown from "C#" to "QuickScript" to test this code.'
      };
    }
  }

  if (lang === 'qs') {
    if (/\b(?:double|bool|int|string|var)\s+\w+\s*=|\bif\s*\(|\bMath\./i.test(cleanCode)) {
      return {
        title: 'Wrong Language Mode Selected',
        tip: 'This script uses ArchestrA C# code (e.g., "double", "Math.", "if ()"). Switch the top dropdown from "QuickScript" to "C#" to run this code.'
      };
    }
  }

  return null;
}

// Main Validator Engine
function validate(code, lang) {
  const out = [];
  const lines = code.split('\n');

  // Helper to add structured, user-friendly messages
  const add = (lineNum, sev, title, tip, fix = '') => {
    out.push({
      line: lineNum,
      sev: sev, // 'error' | 'warn' | 'info'
      msg: title,
      tip: tip,
      fix: fix
    });
  };

  if (!code.trim()) {
    add(1, 'info', 'Sandbox is Empty', 'Select an industry template from the left panel to load a working automation script.');
    return out;
  }

  // Dialect verification
  const dialectCheck = detectDialect(code, lang);
  if (dialectCheck) {
    add(1, 'warn', dialectCheck.title, dialectCheck.tip);
  }

  // Sanitize comments and strings for accurate syntax counts
  const sanitizedCode = code
    .replace(/\{[\s\S]*?\}/g, ' ')      // QuickScript { comments }
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // C# multi-line comments
    .replace(/\/\/.*/g, ' ')            // Single line // comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""'); // Quoted string contents

  const countPattern = (regex) => (sanitizedCode.match(regex) || []).length;

  // ==========================================
  // 1. INTOUCH QUICKSCRIPT VALIDATION
  // ==========================================
  if (lang === 'qs') {
    const ifCount = countPattern(/\bIF\b/gi);
    const endifCount = countPattern(/\bENDIF\b/gi);
    if (ifCount !== endifCount) {
      add(
        1,
        'error',
        `Unclosed Logic Block (${ifCount} IF vs ${endifCount} ENDIF)`,
        `Every IF statement in QuickScript must finish with an ENDIF;. You have ${Math.abs(ifCount - endifCount)} missing closure(s).`,
        'Add ENDIF; at the end of your conditional block.'
      );
    }

    const whileCount = countPattern(/\bWHILE\b/gi);
    const endwhileCount = countPattern(/\bENDWHILE\b/gi);
    if (whileCount !== endwhileCount) {
      add(
        1,
        'error',
        `Unclosed Loop (${whileCount} WHILE vs ${endwhileCount} ENDWHILE)`,
        'Make sure every WHILE loop has a matching ENDWHILE;.',
        'Add ENDWHILE; at the end of your loop.'
      );
    }

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // Skip comment-only or empty lines
      if (!line || line.startsWith('{') || line.startsWith('//')) return;

      // Check IF without THEN
      if (/^\s*IF\b/i.test(line) && !/\bTHEN\b/i.test(line)) {
        add(
          lineNum,
          'error',
          'Missing "THEN" in condition',
          'In QuickScript, every IF statement must be written like: IF [Condition] THEN',
          'Add THEN after your condition.'
        );
      }

      // Dangerous infinite loops that freeze SCADA view engines
      if (/\bWHILE\s+(1|TRUE|-1)\b/i.test(line)) {
        add(
          lineNum,
          'error',
          'Dangerous Infinite Loop Detected',
          'A WHILE 1 loop will freeze your Wonderware View HMI window. Use a periodic Condition Script instead.'
        );
      }

      // Unquoted window navigation calls
      if (/\b(Show|Hide|ShowWindow)\s+[^"\s;]/i.test(line)) {
        add(
          lineNum,
          'error',
          'Unquoted Window Name',
          'HMI screen names must be wrapped in quotation marks.',
          'Example: Show "Overview_Screen";'
        );
      }

      // Invalid SCADA tag naming conventions
      if (/\b[0-9]+[A-Za-z_]\w*/.test(line) && !line.includes('//') && !line.includes('{')) {
        add(
          lineNum,
          'warn',
          'Invalid Tag Naming Convention',
          'SCADA tags cannot start with a number. Use an alphabet prefix (e.g., TK_101 instead of 101_TK).'
        );
      }

      // Semicolon check
      const isBlockKeyword = /^(IF|ELSE|ENDIF|WHILE|ENDWHILE|FOR|NEXT)$/i.test(line);
      const endsProperly = /(;|THEN|\{|\})\s*$/.test(line);
      if (!isBlockKeyword && !endsProperly && !line.endsWith('}')) {
        add(
          lineNum,
          'warn',
          'Missing Semicolon (;)',
          'InTouch QuickScript statements must end with a semicolon.',
          'Add a semicolon (;) to the end of this line.'
        );
      }
    });

  // ==========================================
  // 2. ARCHESTRA C# VALIDATION
  // ==========================================
  } else if (lang === 'cs') {
    const openBraces = countPattern(/\{/g);
    const closeBraces = countPattern(/\}/g);
    if (openBraces !== closeBraces) {
      add(
        1,
        'error',
        `Bracket Mismatch (${openBraces} '{' vs ${closeBraces} '}')`,
        'Every opening curly bracket { must have a matching closing bracket }.',
        'Check that all code blocks are properly closed.'
      );
    }

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      if (!line || line.startsWith('//') || line.startsWith('/*')) return;

      // Blocking threads in ArchestrA scan engines
      if (/\bThread\.Sleep\b/.test(line)) {
        add(
          lineNum,
          'warn',
          'Scan Engine Blocker (Thread.Sleep)',
          'Thread.Sleep will stall the ArchestrA AppEngine scan cycle for all objects hosted on this engine. Use a timer attribute instead.'
        );
      }

      // Infinite while loops
      if (/while\s*\(\s*true\s*\)/i.test(line) && !code.includes('break;')) {
        add(
          lineNum,
          'error',
          'Unbreakable while(true) loop',
          'This loop will hang the ArchestrA execution engine because there is no break statement.'
        );
      }

      // Direct compound operator warning on Me. attributes
      if (/Me\.\w+(\.\w+)?\s*(\+=|-=|\*=|\/=)/.test(line)) {
        add(
          lineNum,
          'warn',
          'Compound Assignment on Me Attribute',
          'ArchestrA attributes are COM wrappers. Expressions like "Me.Tag += 1" can cause compilation errors.',
          'Rewrite as: Me.Tag = Me.Tag + 1;'
        );
      }
    });

  // ==========================================
  // 3. HISTORIAN SQL VALIDATION
  // ==========================================
  } else if (lang === 'sql') {
    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      if (/\bSELECT\s+\*/i.test(line)) {
        add(
          lineNum,
          'warn',
          'Inefficient Query (SELECT *)',
          'Historian databases store billions of rows. Running SELECT * can time out the server. Explicitly list the tags you need (e.g., TagName, DateTime, Value).'
        );
      }
    });

    if (/\bFROM\s+(Live|History|WideHistory)\b/i.test(code) && !/\bWHERE\b/i.test(code)) {
      add(
        1,
        'warn',
        'Missing Time Boundary (No WHERE clause)',
        'Historian queries require a date/time filter (e.g., WHERE DateTime >= DATEADD(hh,-24,GETDATE())). Querying without a filter can crash the client.'
      );
    }
  }

  return out;
}
