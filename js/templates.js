/**
 * Industrial Automation Script Templates
 * WonderCode Sandbox - Standardized Presets with Non-Coder Metadata
 */

const TEMPLATES = [
  {
    g: 'Oil & Gas',
    n: 'HH alarm ESD interlock',
    l: 'qs',
    desc: 'Emergency Shutdown (ESD): Automatically closes the inlet isolation valve if tank level reaches High-High (HH) alarm threshold.',
    inputs: [
      { tag: 'TK_101_LIT_PV', label: 'Tank Level', unit: '%', min: 0, max: 100, default: 50, tip: 'Level Indicating Transmitter - Current Liquid Height' },
      { tag: 'TK_101_HH_SP', label: 'High-High Setpoint', unit: '%', min: 50, max: 100, default: 85, tip: 'Trip Threshold: Level above this closes the emergency valve' }
    ],
    outputs: [
      { tag: 'TK_101_ESD_Cmd', label: 'ESD Safety Trip (1 = Active)', type: 'discrete', tip: 'Emergency Shutdown Command to DCS' },
      { tag: 'XV_101_Close', label: 'Emergency Inlet Valve (1 = Closed)', type: 'discrete', tip: 'Actuator output to solenoid valve' }
    ],
    c: `{ Tank farm ESD: High-High level closes inlet valve with 2% safety deadband }
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
    desc: 'Calculates true liquid inventory in cubic meters (m³) and standard oil barrels (bbl) from tank level height (mm).',
    inputs: [
      { tag: 'Diameter_m', label: 'Tank Diameter', unit: 'm', min: 1, max: 50, default: 12, tip: 'Internal diameter of cylindrical storage tank' },
      { tag: 'LIT_PV', label: 'Measured Level', unit: 'mm', min: 0, max: 15000, default: 7500, tip: 'Level transmitter reading in millimeters' }
    ],
    outputs: [
      { tag: 'Volume_m3', label: 'Net Volume', unit: 'm³', type: 'analog', tip: 'Calculated liquid volume in cubic meters' },
      { tag: 'Volume_bbl', label: 'Net Volume', unit: 'bbl', type: 'analog', tip: 'Standard US Petroleum Barrels (1 m³ = 6.28981 bbl)' }
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
    desc: 'Totalizes flow rate (m³/h) into accumulated volume (m³) each second, verifying OPC/DCS signal quality first.',
    inputs: [
      { tag: 'FIT_PV', label: 'Flow Rate', unit: 'm³/h', min: 0, max: 1000, default: 250, tip: 'Flow Indicating Transmitter' },
      { tag: 'FIT_Quality', label: 'Signal Quality', min: 0, max: 255, default: 192, tip: '192 indicates OPC Good Quality status' }
    ],
    outputs: [
      { tag: 'Total_m3', label: 'Totalized Flow', unit: 'm³', type: 'analog', tip: 'Cumulative volume delivered through pipeline' }
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
    desc: 'Rotates Lead/Lag duties between two pumps upon electrical fault or automatically every 24 hours of runtime.',
    inputs: [
      { tag: 'WW_LIT_PV', label: 'Sump Level', unit: 'm', min: 0, max: 10, default: 6, tip: 'Wet Well water level transmitter' },
      { tag: 'Start_SP', label: 'Start Setpoint', unit: 'm', min: 1, max: 9, default: 5, tip: 'Level at which lead pump starts' },
      { tag: 'PUMP_01_Fault', label: 'Pump 1 Fault Switch', type: 'discrete', default: 0, tip: 'Overload or VFD fault trip' },
      { tag: 'Rotate_Timer_PV', label: 'Rotation Elapsed Timer', unit: 's', min: 0, max: 86400, default: 0, tip: 'Elapsed run time in seconds (86400 s = 24 h)' }
    ],
    outputs: [
      { tag: 'Duty_Pump', label: 'Current Duty Pump (1 or 2)', type: 'analog', tip: 'Indicates which pump has lead priority' },
      { tag: 'PUMP_01_Cmd_Start', label: 'Pump 1 Start Command', type: 'discrete', tip: 'Output to Pump 1 contactor' },
      { tag: 'PUMP_02_Cmd_Start', label: 'Pump 2 Start Command', type: 'discrete', tip: 'Output to Pump 2 contactor' }
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
    desc: 'Adjusts sodium hypochlorite dosing pump speed proportionally based on measured residual chlorine error.',
    inputs: [
      { tag: 'Cl2_SP', label: 'Target Chlorine', unit: 'ppm', min: 0, max: 5, default: 2.0, tip: 'Disinfection target residual setpoint' },
      { tag: 'Cl2_AIT_PV', label: 'Measured Chlorine', unit: 'ppm', min: 0, max: 5, default: 1.6, tip: 'Analytical analyzer reading' },
      { tag: 'Base_Speed', label: 'Base Pump Speed', unit: '%', min: 0, max: 100, default: 45, tip: 'Nominal stroke rate' },
      { tag: 'Kp', label: 'Proportional Gain (Kp)', min: 1, max: 50, default: 15, tip: 'Control loop tuning factor' }
    ],
    outputs: [
      { tag: 'DosePump_Speed', label: 'Dosing Pump Command', unit: '%', type: 'analog', tip: 'Speed output sent to chemical metering pump' }
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
    desc: 'Stages three stormwater lift pumps sequentially as the sump rises, stopping all pumps when level drops below low setpoint.',
    inputs: [
      { tag: 'WW_LIT_PV', label: 'Wet Well Level', unit: 'm', min: 0, max: 5, default: 1.5, tip: 'Depth of water in sump chamber' }
    ],
    outputs: [
      { tag: 'PUMP_01_Cmd_Start', label: 'Pump 1 (Lead)', type: 'discrete', tip: 'Starts at 2.0 m' },
      { tag: 'PUMP_02_Cmd_Start', label: 'Pump 2 (Lag 1)', type: 'discrete', tip: 'Starts at 2.8 m' },
      { tag: 'PUMP_03_Cmd_Start', label: 'Pump 3 (Lag 2)', type: 'discrete', tip: 'Starts at 3.5 m' }
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
    desc: 'Calculates active chiller count required to meet cooling demand without cycling compressors excessively.',
    inputs: [
      { tag: 'DCP_Load_kW', label: 'District Thermal Load', unit: 'kW', min: 0, max: 15000, default: 6200, tip: 'Combined cooling load required by campus' },
      { tag: 'CH_Cap_kW', label: 'Chiller Rated Capacity', unit: 'kW', min: 1000, max: 5000, default: 3000, tip: 'Cooling capacity of each individual chiller machine' }
    ],
    outputs: [
      { tag: 'CH_01_Cmd_Run', label: 'Chiller 1 Enable', type: 'discrete', tip: 'Stage 1 machine' },
      { tag: 'CH_02_Cmd_Run', label: 'Chiller 2 Enable', type: 'discrete', tip: 'Stage 2 machine' },
      { tag: 'CH_03_Cmd_Run', label: 'Chiller 3 Enable', type: 'discrete', tip: 'Stage 3 machine' }
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
    desc: 'Slews variable frequency drive speed command at 2%/second to prevent pipe water hammer and voltage spikes.',
    inputs: [
      { tag: 'Speed_SP', label: 'Target Speed', unit: '%', min: 0, max: 100, default: 80, tip: 'Operator requested running speed' },
      { tag: 'Speed_Cmd', label: 'Current Ramp Speed', unit: '%', min: 0, max: 100, default: 20, tip: 'Current output to frequency inverter' }
    ],
    outputs: [
      { tag: 'Speed_Cmd', label: 'Ramped Speed Output', unit: '%', type: 'analog', tip: 'Smoothly modulated speed signal' }
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
    g: 'District Cooling',
    n: 'TES charge/discharge valves',
    l: 'qs',
    desc: 'Break-before-make interlocked sequencing for thermal storage charge and discharge valves to avoid cross-circulation.',
    inputs: [
      { tag: 'TES_Mode', label: 'Mode (0=Idle, 1=Chg, 2=Disch)', min: 0, max: 2, default: 1, tip: 'Thermal Energy Storage operational state' },
      { tag: 'TES_Temp_Top_PV', label: 'Top Temperature', unit: '°C', min: 0, max: 20, default: 8.0, tip: 'Warm water layer temperature at tank crown' },
      { tag: 'TES_Level_PV', label: 'Tank Level', unit: '%', min: 0, max: 100, default: 60, tip: 'Storage tank inventory level' },
      { tag: 'TES_CV_Dis_ClosedFb', label: 'Discharge Valve Closed Switch', type: 'discrete', default: 1, tip: 'Limit switch feedback confirming closed state' },
      { tag: 'TES_CV_Chg_ClosedFb', label: 'Charge Valve Closed Switch', type: 'discrete', default: 1, tip: 'Limit switch feedback confirming closed state' },
      { tag: 'TES_Interlock_Trip', label: 'Emergency Trip Interlock', type: 'discrete', default: 0, tip: 'Trip signal overrides and closes all valves' }
    ],
    outputs: [
      { tag: 'TES_CV_Chg_Cmd', label: 'Charge Valve Open Command', type: 'discrete', tip: 'Actuation command to charge control valve' },
      { tag: 'TES_CV_Dis_Cmd', label: 'Discharge Valve Open Command', type: 'discrete', tip: 'Actuation command to discharge control valve' }
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
    desc: 'Chilled water differential pressure modulation: auto-starts secondary lag pump when lead drive exceeds 95% speed.',
    inputs: [
      { tag: 'CHW_DP_SP', label: 'Target DP Setpoint', unit: 'bar', min: 1, max: 6, default: 3.5, tip: 'Required index riser differential pressure' },
      { tag: 'CHW_DP_PV', label: 'Measured Header DP', unit: 'bar', min: 1, max: 6, default: 2.8, tip: 'Current field differential pressure measurement' },
      { tag: 'Lead_Speed', label: 'Lead Pump Speed', unit: '%', min: 0, max: 100, default: 85, tip: 'Current speed command of operational pump' },
      { tag: 'Lag_Run_Fb', label: 'Lag Pump Running Feedback', type: 'discrete', default: 0, tip: 'Feedback confirming lag pump motor is rotating' },
      { tag: 'Kp', label: 'Proportional Gain', min: 0.1, max: 5.0, default: 1.2, tip: 'Loop gain factor' }
    ],
    outputs: [
      { tag: 'Lead_Speed', label: 'Lead Speed Command', unit: '%', type: 'analog', tip: 'Output to lead variable speed drive' },
      { tag: 'Lag_Cmd', label: 'Lag Pump Start Command', type: 'discrete', tip: 'Starts secondary pump when lead is overloaded' },
      { tag: 'Lag_Speed', label: 'Lag Speed Command', unit: '%', type: 'analog', tip: 'Synchronized speed to lag drive' }
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
    desc: 'Slip protection: Trips the conveyor motor if the contactor is commanded to run but the pulse zero-speed switch detects no rotation for 10 s.',
    inputs: [
      { tag: 'CV_101_Run_Fb', label: 'Motor Auxiliary Contact Run Feedback', type: 'discrete', default: 1, tip: '1 confirms motor starter is energized' },
      { tag: 'CV_101_ZSS_Sw', label: 'Zero Speed Switch (1 = Stopped)', type: 'discrete', default: 1, tip: 'Proximity sensor on non-driven tail pulley' },
      { tag: 'CV_101_Reset', label: 'Trip Reset Pushbutton', type: 'discrete', default: 0, tip: 'Operator reset button on MCC panel' }
    ],
    outputs: [
      { tag: 'CV_101_Slip_Trip', label: 'Belt Slip Fault Trip', type: 'discrete', tip: 'Tripped safety condition' },
      { tag: 'CV_101_Run_Cmd', label: 'Motor Run Command', type: 'discrete', tip: 'Permissive contact to drive or soft-starter' }
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
    desc: 'Equipment protection: Emergency shutdown if lube oil temperature exceeds 65°C or lubrication flow drops below 8 L/min for 5 continuous seconds.',
    inputs: [
      { tag: 'JC_Lube_Temp_PV', label: 'Lube Oil Temperature', unit: '°C', min: 20, max: 100, default: 68, tip: 'Temperature transmitter on bearing oil reservoir' },
      { tag: 'JC_Lube_Flow_PV', label: 'Lube Oil Flow Rate', unit: 'L/min', min: 0, max: 20, default: 5, tip: 'Positive displacement lube flow transmitter' }
    ],
    outputs: [
      { tag: 'JC_Trip', label: 'Crusher Motor Trip Output', type: 'discrete', tip: 'De-energizes primary crusher drive' },
      { tag: 'JC_Run_Cmd', label: 'Crusher Permissive Run Command', type: 'discrete', tip: 'Main run permissive output' }
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
    desc: 'Pasteurization safety: Diverts milk back to raw balance tank if holding tube temperature falls below the 72.0°C legal legal minimum.',
    inputs: [
      { tag: 'HT_Hold_Temp_PV', label: 'Holding Tube Temperature', unit: '°C', min: 60, max: 85, default: 72.0, tip: 'Sanitary RTD temperature transmitter at holding tube discharge' },
      { tag: 'HT_Hold_Temp_SP', label: 'Legal Pasteurization Setpoint', unit: '°C', min: 70, max: 75, default: 72.5, tip: 'Statutory regulatory temperature minimum' },
      { tag: 'HT_Flow_PV', label: 'Milk Flow Rate', unit: 'L/h', min: 0, max: 5000, default: 2500, tip: 'Electromagnetic sanitary flow meter' },
      { tag: 'HT_Flow_Min_SP', label: 'Minimum Legal Flow', unit: 'L/h', min: 500, max: 2000, default: 1000, tip: 'Velocity verification for holding tube residence time' },
      { tag: 'HT_Reset', label: 'Safety Reset Pushbutton', type: 'discrete', default: 0, tip: 'Manual operator reset required after sub-temperature trip' }
    ],
    outputs: [
      { tag: 'HT_Divert_Fwd', label: 'Flow Divert Valve (1 = Forward, 0 = Divert)', type: 'discrete', tip: 'Directs pasteurized product to cooling section' },
      { tag: 'HT_Interlock_Trip', label: 'Latched Safety Trip', type: 'discrete', tip: 'Interlock state requiring physical push of Reset button' }
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
