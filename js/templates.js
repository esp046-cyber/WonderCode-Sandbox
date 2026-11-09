/**
 * Industrial Automation Script Templates
 * WonderCode Sandbox - Standardized Presets with Non-Coder Metadata
 */

const TEMPLATES = [
  {
    g: 'Oil & Gas',
    n: 'HH alarm ESD interlock',
    l: 'qs',
    desc: 'Emergency Shutdown: Automatically trips the inlet valve if tank liquid level exceeds the High-High safety threshold.',
    inputs: [
      { tag: 'TK_101_LIT_PV', label: 'Tank Level', unit: '%', min: 0, max: 100, default: 50 },
      { tag: 'TK_101_HH_SP', label: 'High-High Trip Setpoint', unit: '%', min: 50, max: 100, default: 85 }
    ],
    outputs: [
      { tag: 'TK_101_ESD_Cmd', label: 'ESD Trip Alarm (1 = Tripped)', type: 'discrete' },
      { tag: 'XV_101_Close', label: 'Inlet Emergency Valve (1 = Closed)', type: 'discrete' }
    ],
    c: `{ Tank farm ESD: High-High level closes inlet valve with 2% deadband }
IF TK_101_LIT_PV >= TK_101_HH_SP THEN
    TK_101_ESD_Cmd = 1;
    XV_101_Close = 1;
ELSE
    IF TK_101_LIT_PV < (TK_101_HH_SP - 2.0) THEN
        TK_101_ESD_Cmd = 0;
        XV_101_Close = 0;
    ENDIF;
ENDIF;

{ Historian Mirror Tags }
Hist_TK_101_LIT_PV = TK_101_LIT_PV;
Hist_TK_101_HH_SP = TK_101_HH_SP;
Hist_TK_101_ESD_Cmd = TK_101_ESD_Cmd;
Hist_XV_101_Close = XV_101_Close;
`
  },
  {
    g: 'Oil & Gas',
    n: 'Tank volume (strapping)',
    l: 'cs',
    desc: 'Calculates liquid volume in cubic meters (m³) and barrels (bbl) from millimeters of tank level height.',
    inputs: [
      { tag: 'Diameter_m', label: 'Tank Diameter', unit: 'm', min: 1, max: 50, default: 12 },
      { tag: 'LIT_PV', label: 'Level Reading', unit: 'mm', min: 0, max: 15000, default: 7500 }
    ],
    outputs: [
      { tag: 'Volume_m3', label: 'Net Volume', unit: 'm³', type: 'analog' },
      { tag: 'Volume_bbl', label: 'Net Volume', unit: 'bbl', type: 'analog' }
    ],
    c: `// Cylindrical tank: m3 and bbl calculation from level mm
double dia = Convert.ToDouble(Me.Diameter_m);
double lvl = Convert.ToDouble(Me.LIT_PV) / 1000.0;
double radius = dia / 2.0;

Me.Volume_m3 = Math.PI * Math.Pow(radius, 2) * lvl;
Me.Volume_bbl = Convert.ToDouble(Me.Volume_m3) * 6.28981;
`
  },
  {
    g: 'Oil & Gas',
    n: 'Pipeline flow accumulator',
    l: 'cs',
    desc: 'Accumulates flow rate (m³/h) into totalized volume (m³) every second with quality code checking.',
    inputs: [
      { tag: 'FIT_PV', label: 'Flow Rate', unit: 'm³/h', min: 0, max: 1000, default: 250 },
      { tag: 'FIT_Quality', label: 'Signal Quality (192 = Good)', min: 0, max: 255, default: 192 }
    ],
    outputs: [
      { tag: 'Total_m3', label: 'Totalized Flow', unit: 'm³', type: 'analog' }
    ],
    c: `// Execute @ 1-second scan rate: m3/h converted to m3 increment
if (Convert.ToDouble(Me.FIT_PV) > 0.0 && Convert.ToInt32(Me.FIT_Quality) == 192)
{
    Me.Total_m3 = Convert.ToDouble(Me.Total_m3) + (Convert.ToDouble(Me.FIT_PV) / 3600.0);
}
`
  },
  {
    g: 'Water',
    n: 'Duty/standby pump rotation',
    l: 'qs',
    desc: 'Alternates duty between two pumps upon fault or every 24 hours of operation.',
    inputs: [
      { tag: 'WW_LIT_PV', label: 'Wet Well Level', unit: 'm', min: 0, max: 10, default: 6 },
      { tag: 'Start_SP', label: 'Lead Start Setpoint', unit: 'm', min: 1, max: 9, default: 5 },
      { tag: 'PUMP_01_Fault', label: 'Pump 1 Faulted', type: 'discrete', default: 0 },
      { tag: 'Rotate_Timer_PV', label: 'Rotation Timer', unit: 'sec', min: 0, max: 86400, default: 0 }
    ],
    outputs: [
      { tag: 'Duty_Pump', label: 'Active Duty Pump (1 or 2)', type: 'analog' },
      { tag: 'PUMP_01_Cmd_Start', label: 'Pump 1 Start Command', type: 'discrete' },
      { tag: 'PUMP_02_Cmd_Start', label: 'Pump 2 Start Command', type: 'discrete' }
    ],
    c: `{ Duty/Standby pump alternating routine }
IF PUMP_01_Fault == 1 OR Rotate_Timer_PV >= 86400 THEN
    Duty_Pump = 3 - Duty_Pump;
    Rotate_Timer_PV = 0;
ENDIF;

IF WW_LIT_PV > Start_SP THEN
    IF Duty_Pump == 1 THEN
        PUMP_01_Cmd_Start = 1;
        PUMP_02_Cmd_Start = 0;
    ELSE
        PUMP_01_Cmd_Start = 0;
        PUMP_02_Cmd_Start = 1;
    ENDIF;
ELSE
    PUMP_01_Cmd_Start = 0;
    PUMP_02_Cmd_Start = 0;
ENDIF;
`
  },
  {
    g: 'Water',
    n: 'Chemical dosing feedback',
    l: 'cs',
    desc: 'Proportional chlorine dosing speed control bounded safely between 0% and 100%.',
    inputs: [
      { tag: 'Cl2_SP', label: 'Target Chlorine', unit: 'ppm', min: 0, max: 5, default: 2.0 },
      { tag: 'Cl2_AIT_PV', label: 'Measured Chlorine', unit: 'ppm', min: 0, max: 5, default: 1.6 },
      { tag: 'Base_Speed', label: 'Base Pump Speed', unit: '%', min: 0, max: 100, default: 45 },
      { tag: 'Kp', label: 'Gain (Kp)', min: 1, max: 50, default: 15 }
    ],
    outputs: [
      { tag: 'DosePump_Speed', label: 'Dosing Pump Speed', unit: '%', type: 'analog' }
    ],
    c: `// Proportional feedback dosing control
double err = Convert.ToDouble(Me.Cl2_SP) - Convert.ToDouble(Me.Cl2_AIT_PV);
double trim = Math.Max(-20.0, Math.Min(20.0, err * Convert.ToDouble(Me.Kp)));
double finalSpeed = Convert.ToDouble(Me.Base_Speed) + trim;

Me.DosePump_Speed = Math.Max(0.0, Math.Min(100.0, finalSpeed));
`
  },
  {
    g: 'Water',
    n: 'Wet well level sequencer',
    l: 'qs',
    desc: 'Stages three pumps sequentially as the sump rises; stops all pumps when level drops below low setpoint.',
    inputs: [
      { tag: 'WW_LIT_PV', label: 'Wet Well Level', unit: 'm', min: 0, max: 5, default: 1.5 }
    ],
    outputs: [
      { tag: 'PUMP_01_Cmd_Start', label: 'Pump 1 (Lead)', type: 'discrete' },
      { tag: 'PUMP_02_Cmd_Start', label: 'Pump 2 (Lag 1)', type: 'discrete' },
      { tag: 'PUMP_03_Cmd_Start', label: 'Pump 3 (Lag 2)', type: 'discrete' }
    ],
    c: `{ Level staging with low-level interlock cut-off }
IF WW_LIT_PV >= 3.5 THEN 
    PUMP_03_Cmd_Start = 1; 
ENDIF;

IF WW_LIT_PV >= 2.8 THEN 
    PUMP_02_Cmd_Start = 1; 
ENDIF;

IF WW_LIT_PV >= 2.0 THEN 
    PUMP_01_Cmd_Start = 1; 
ENDIF;

IF WW_LIT_PV <= 0.8 THEN
    PUMP_01_Cmd_Start = 0;
    PUMP_02_Cmd_Start = 0;
    PUMP_03_Cmd_Start = 0;
ENDIF;
`
  },
  {
    g: 'Infrastructure',
    n: 'Chiller sequencing',
    l: 'qs',
    desc: 'Calculates necessary operational chiller count based on thermal load and chiller capacity.',
    inputs: [
      { tag: 'DCP_Load_kW', label: 'Current District Load', unit: 'kW', min: 0, max: 15000, default: 6200 },
      { tag: 'CH_Cap_kW', label: 'Unit Chiller Capacity', unit: 'kW', min: 1000, max: 5000, default: 3000 }
    ],
    outputs: [
      { tag: 'CH_01_Cmd_Run', label: 'Chiller 1 Enable', type: 'discrete' },
      { tag: 'CH_02_Cmd_Run', label: 'Chiller 2 Enable', type: 'discrete' },
      { tag: 'CH_03_Cmd_Run', label: 'Chiller 3 Enable', type: 'discrete' }
    ],
    c: `{ Chiller staging calculation }
DIM stages AS INTEGER;
stages = (DCP_Load_kW / CH_Cap_kW) + 1;

IF stages > 3 THEN 
    stages = 3; 
ENDIF;

CH_01_Cmd_Run = (stages >= 1);
CH_02_Cmd_Run = (stages >= 2);
CH_03_Cmd_Run = (stages >= 3);
`
  },
  {
    g: 'Infrastructure',
    n: 'VFD speed ramp',
    l: 'cs',
    desc: 'Ramps drive speed command at 2%/second to prevent water hammer and mechanical shear.',
    inputs: [
      { tag: 'Speed_SP', label: 'Operator Target Speed', unit: '%', min: 0, max: 100, default: 80 },
      { tag: 'Speed_Cmd', label: 'Current Ramp Speed', unit: '%', min: 0, max: 100, default: 20 }
    ],
    outputs: [
      { tag: 'Speed_Cmd', label: 'Ramped Output to Drive', unit: '%', type: 'analog' }
    ],
    c: `// Execute @ 1 s: Ramps 2.0 %/s towards setpoint
double step = 2.0;
double sp = Convert.ToDouble(Me.Speed_SP);
double current = Convert.ToDouble(Me.Speed_Cmd);
double delta = sp - current;

if (Math.Abs(delta) <= step)
{
    Me.Speed_Cmd = sp;
}
else
{
    Me.Speed_Cmd = current + (Math.Sign(delta) * step);
}
`
  },
  {
    g: 'Data & mapping',
    n: 'Historian: 24 h hourly avg',
    l: 'sql',
    desc: 'Queries AVEVA Historian for 24-hour hourly time-weighted average process values.',
    inputs: [],
    outputs: [],
    c: `SELECT 
    DateTime, 
    TagName, 
    AVG(Value) AS AvgValue
FROM History
WHERE TagName IN ('TK_101_LIT.PV', 'FIT_201.PV')
  AND DateTime >= DATEADD(hh, -24, GETDATE())
  AND wwResolution = 3600000
GROUP BY DateTime, TagName
ORDER BY DateTime ASC;
`
  },
  {
    g: 'District Cooling',
    n: 'TES charge/discharge valves',
    l: 'qs',
    desc: 'Break-before-make interlocked actuation for thermal energy storage (TES) charge and discharge isolation valves.',
    inputs: [
      { tag: 'TES_Mode', label: 'Mode (0=Idle, 1=Charge, 2=Discharge)', min: 0, max: 2, default: 1 },
      { tag: 'TES_Temp_Top_PV', label: 'Top Temperature', unit: '°C', min: 0, max: 20, default: 8.0 },
      { tag: 'TES_Level_PV', label: 'Tank Level', unit: '%', min: 0, max: 100, default: 60 },
      { tag: 'TES_CV_Dis_ClosedFb', label: 'Discharge Valve Closed Switch', type: 'discrete', default: 1 },
      { tag: 'TES_CV_Chg_ClosedFb', label: 'Charge Valve Closed Switch', type: 'discrete', default: 1 },
      { tag: 'TES_Interlock_Trip', label: 'Safety Trip Interlock', type: 'discrete', default: 0 }
    ],
    outputs: [
      { tag: 'TES_CV_Chg_Cmd', label: 'Charge Valve Open Cmd', type: 'discrete' },
      { tag: 'TES_CV_Dis_Cmd', label: 'Discharge Valve Open Cmd', type: 'discrete' }
    ],
    c: `{ TES valve sequencer: Break-before-make safety }
IF (TES_Mode == 1) AND (TES_Temp_Top_PV > 5.5) THEN
    TES_CV_Dis_Cmd = 0;
    IF TES_CV_Dis_ClosedFb == 1 THEN 
        TES_CV_Chg_Cmd = 1; 
    ENDIF;
ENDIF;

IF (TES_Mode == 2) AND (TES_Level_PV > 10.0) THEN
    TES_CV_Chg_Cmd = 0;
    IF TES_CV_Chg_ClosedFb == 1 THEN 
        TES_CV_Dis_Cmd = 1; 
    ENDIF;
ENDIF;

{ Interlock trip or idle immediately isolates both valves }
IF (TES_Mode == 0) OR (TES_Interlock_Trip == 1) THEN
    TES_CV_Chg_Cmd = 0;
    TES_CV_Dis_Cmd = 0;
ENDIF;
`
  },
  {
    g: 'District Cooling',
    n: 'CHW DP lead/lag pump ramp',
    l: 'cs',
    desc: 'Chilled water differential pressure pump ramping; auto-starts lag pump if lead speed exceeds 95%.',
    inputs: [
      { tag: 'CHW_DP_SP', label: 'Target Diff Pressure', unit: 'bar', min: 1, max: 6, default: 3.5 },
      { tag: 'CHW_DP_PV', label: 'Measured Diff Pressure', unit: 'bar', min: 1, max: 6, default: 2.8 },
      { tag: 'Lead_Speed', label: 'Lead Pump Speed', unit: '%', min: 0, max: 100, default: 85 },
      { tag: 'Lag_Run_Fb', label: 'Lag Pump Running Feedback', type: 'discrete', default: 0 },
      { tag: 'Kp', label: 'Loop Gain', min: 0.1, max: 5.0, default: 1.2 }
    ],
    outputs: [
      { tag: 'Lead_Speed', label: 'Lead Speed Command', unit: '%', type: 'analog' },
      { tag: 'Lag_Cmd', label: 'Lag Start Command', type: 'discrete' },
      { tag: 'Lag_Speed', label: 'Lag Speed Command', unit: '%', type: 'analog' }
    ],
    c: `// Secondary CHW DP control (Scan: 1 s)
double err = Convert.ToDouble(Me.CHW_DP_SP) - Convert.ToDouble(Me.CHW_DP_PV);
double currentSpeed = Convert.ToDouble(Me.Lead_Speed);
double kp = Convert.ToDouble(Me.Kp);

Me.Lead_Speed = Math.Max(20.0, Math.Min(100.0, currentSpeed + (err * kp)));

if (Convert.ToDouble(Me.Lead_Speed) >= 95.0 && Convert.ToInt32(Me.Lag_Run_Fb) == 0) {
    Me.Lag_Cmd = 1;
}

if (Convert.ToDouble(Me.Lead_Speed) <= 40.0 && Convert.ToInt32(Me.Lag_Run_Fb) == 1) {
    Me.Lag_Cmd = 0;
}

if (Convert.ToInt32(Me.Lag_Cmd) == 1) {
    Me.Lag_Speed = Me.Lead_Speed;
} else {
    Me.Lag_Speed = 0.0;
}
`
  },
  {
    g: 'Metals & Minerals',
    n: 'Conveyor zero-speed/slip trip',
    l: 'qs',
    desc: 'Monitors conveyor run command against zero-speed switch; trips motor if slip is sustained for 10 seconds.',
    inputs: [
      { tag: 'CV_101_Run_Fb', label: 'Motor Contactor Run Feedback', type: 'discrete', default: 1 },
      { tag: 'CV_101_ZSS_Sw', label: 'Zero Speed Switch (1 = Stopped)', type: 'discrete', default: 1 },
      { tag: 'CV_101_Reset', label: 'Operator Reset PB', type: 'discrete', default: 0 }
    ],
    outputs: [
      { tag: 'CV_101_Slip_Trip', label: 'Belt Slip Fault Trip', type: 'discrete' },
      { tag: 'CV_101_Run_Cmd', label: 'Conveyor Motor Run Command', type: 'discrete' }
    ],
    c: `{ Belt slip detection: Motor commanded but speed sensor detects stop }
IF CV_101_Run_Fb == 1 AND CV_101_ZSS_Sw == 1 THEN
    CV_101_Slip_Timer_PV = CV_101_Slip_Timer_PV + 1;
ELSE
    CV_101_Slip_Timer_PV = 0;
ENDIF;

IF CV_101_Slip_Timer_PV >= 10 THEN
    CV_101_Slip_Trip = 1;
    CV_101_Run_Cmd = 0;
ENDIF;

IF CV_101_Reset == 1 THEN
    CV_101_Slip_Trip = 0;
ENDIF;
`
  },
  {
    g: 'Metals & Minerals',
    n: 'Jaw crusher lube oil trips',
    l: 'cs',
    desc: 'Emergency interlock: Trips the crusher motor if oil temperature exceeds 65°C or lube flow drops below 8 L/min.',
    inputs: [
      { tag: 'JC_Lube_Temp_PV', label: 'Lube Oil Temperature', unit: '°C', min: 20, max: 100, default: 68 },
      { tag: 'JC_Lube_Flow_PV', label: 'Lube Oil Flow Rate', unit: 'L/min', min: 0, max: 20, default: 5 }
    ],
    outputs: [
      { tag: 'JC_Trip', label: 'Crusher Trip Output', type: 'discrete' },
      { tag: 'JC_Run_Cmd', label: 'Crusher Enable Command', type: 'discrete' }
    ],
    c: `// Execute @ 1 s scan: High temp or low flow trips crusher after 5 s
bool tempHi = Convert.ToDouble(Me.JC_Lube_Temp_PV) > 65.0;
bool flowLo = Convert.ToDouble(Me.JC_Lube_Flow_PV) < 8.0;

if (tempHi || flowLo) {
    Me.JC_Lube_Timer_PV = Convert.ToInt32(Me.JC_Lube_Timer_PV) + 1;
} else {
    Me.JC_Lube_Timer_PV = 0;
}

if (Convert.ToInt32(Me.JC_Lube_Timer_PV) >= 5) {
    Me.JC_Trip = true;
    Me.JC_Run_Cmd = false;
}
`
  },
  {
    g: 'Food & Beverage',
    n: 'HTST divert valve interlock',
    l: 'cs',
    desc: 'Pasteurizer divert valve safety interlock: Diverts milk back to balance tank if hold tube temperature drops below legal limit.',
    inputs: [
      { tag: 'HT_Hold_Temp_PV', label: 'Holding Tube Temperature', unit: '°C', min: 60, max: 85, default: 72.0 },
      { tag: 'HT_Hold_Temp_SP', label: 'Legal Pasteurization Setpoint', unit: '°C', min: 70, max: 75, default: 72.5 },
      { tag: 'HT_Flow_PV', label: 'Product Flow Rate', unit: 'L/h', min: 0, max: 5000, default: 2500 },
      { tag: 'HT_Flow_Min_SP', label: 'Minimum Legal Flow', unit: 'L/h', min: 500, max: 2000, default: 1000 },
      { tag: 'HT_Reset', label: 'Fault Reset Button', type: 'discrete', default: 0 }
    ],
    outputs: [
      { tag: 'HT_Divert_Fwd', label: 'Forward Valve (1 = Forward, 0 = Divert)', type: 'discrete' },
      { tag: 'HT_Interlock_Trip', label: 'Sub-temperature Latched Trip', type: 'discrete' }
    ],
    c: `// Pasteurizer divert safety interlock
bool tempOk = Convert.ToDouble(Me.HT_Hold_Temp_PV) >= Convert.ToDouble(Me.HT_Hold_Temp_SP);
bool flowOk = Convert.ToDouble(Me.HT_Flow_PV) >= Convert.ToDouble(Me.HT_Flow_Min_SP);

if (!tempOk) {
    Me.HT_Interlock_Trip = true;
}

if (Convert.ToInt32(Me.HT_Reset) == 1 && tempOk) {
    Me.HT_Interlock_Trip = false;
}

bool latched = Convert.ToBoolean(Me.HT_Interlock_Trip);
Me.HT_Divert_Fwd = (tempOk && flowOk && !latched);
`
  }
];
