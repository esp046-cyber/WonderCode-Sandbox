const TEMPLATES=[
{g:'Oil & Gas',n:'HH alarm ESD interlock',l:'qs',c:`{ Tank farm ESD: High-High level closes inlet valve }\nIF TK_101_LIT.PV >= TK_101_HH_SP THEN\n  TK_101_ESD.Cmd = 1;\n  XV_101_Close = 1;\nELSE\n  IF TK_101_LIT.PV < TK_101_HH_SP - 2 THEN\n    TK_101_ESD.Cmd = 0;\n  ENDIF;\nENDIF;\n`},
{g:'Oil & Gas',n:'Tank volume (strapping)',l:'cs',c:`// Cylindrical tank: m3 from level mm\ndouble dia = Me.Diameter_m;\ndouble lvl = Me.LIT.PV / 1000.0;\nMe.Volume_m3 = Math.PI * Math.Pow(dia / 2, 2) * lvl;\nMe.Volume_bbl = Me.Volume_m3 * 6.28981;\n`},
{g:'Oil & Gas',n:'Pipeline flow accumulator',l:'cs',c:`// Execute @ 1 s: m3/h to m3\nif (Me.FIT.PV > 0 && Me.FIT.PV.Quality == 192)\n{\n  Me.Total_m3 = Me.Total_m3 + Me.FIT.PV / 3600.0;\n}\n`},
{g:'Water',n:'Duty/standby pump rotation',l:'qs',c:`IF PUMP_01_Fault == 1 OR (Rotate_Timer.PV >= 86400) THEN\n  Duty_Pump = 3 - Duty_Pump;\n  Rotate_Timer.PV = 0;\nENDIF;\nPUMP_01.Cmd_Start = (Duty_Pump == 1) AND (WW_LIT.PV > Start_SP);\nPUMP_02.Cmd_Start = (Duty_Pump == 2) AND (WW_LIT.PV > Start_SP);\n`},
{g:'Water',n:'Chemical dosing feedback',l:'cs',c:`// Proportional trim on chlorine residual\ndouble err = Me.Cl2_SP - Me.Cl2_AIT.PV;\ndouble trim = Math.Max(-20, Math.Min(20, err * Me.Kp));\nMe.DosePump_Speed = Math.Max(0, Math.Min(100, Me.Base_Speed + trim));\n`},
{g:'Water',n:'Wet well level sequencer',l:'qs',c:`IF WW_LIT.PV >= 3.5 THEN PUMP_03.Cmd_Start = 1; ENDIF;\nIF WW_LIT.PV >= 2.8 THEN PUMP_02.Cmd_Start = 1; ENDIF;\nIF WW_LIT.PV >= 2.0 THEN PUMP_01.Cmd_Start = 1; ENDIF;\nIF WW_LIT.PV <= 0.8 THEN\n  PUMP_01.Cmd_Start = 0;\n  PUMP_02.Cmd_Start = 0;\n  PUMP_03.Cmd_Start = 0;\nENDIF;\n`},
{g:'Infrastructure',n:'Chiller sequencing',l:'qs',c:`DIM stages AS INTEGER;\nstages = DCP_Load_kW / CH_Cap_kW + 1;\nIF stages > 3 THEN stages = 3; ENDIF;\nCH_01.Cmd_Run = stages >= 1;\nCH_02.Cmd_Run = stages >= 2;\nCH_03.Cmd_Run = stages >= 3;\n`},
{g:'Infrastructure',n:'VFD speed ramp',l:'cs',c:`// Ramp 2 %/s toward setpoint (Execute @ 1 s)\ndouble step = 2.0;\ndouble d = Me.Speed_SP - Me.Speed_Cmd;\nMe.Speed_Cmd += Math.Abs(d) <= step ? d : Math.Sign(d) * step;\n`},
{g:'Data & mapping',n:'Historian: 24 h hourly avg',l:'sql',c:`SELECT DateTime, TagName, AVG(Value) AS AvgValue\nFROM History\nWHERE TagName IN ('TK_101_LIT.PV','FIT_201.PV')\n  AND DateTime >= DATEADD(hh,-24,GETDATE())\n  AND wwResolution = 3600000\nGROUP BY DateTime, TagName\nORDER BY DateTime;\n`},
{g:'Data & mapping',n:'S7-400FH / Modbus RTU map',l:'qs',c:`{ S7-400FH DB10.DBD4 (REAL) -> TK_101_LIT.PV\n  Modbus RTU 40001 -> holding reg 0, scale 0.1 }\nTK_101_LIT.PV = ModbusHR_0 / 10.0;\n`},
{g:'District Cooling',n:'TES charge/discharge valves',l:'qs',c:`{ TES valve sequencer. InTouch: TES_Mode, TES_CV_Chg.Cmd, TES_CV_Dis.Cmd, TES_Temp_Top.PV, TES_Level.PV }
{ ArchestrA: Me.TES_Mode (0 idle, 1 charge, 2 discharge), Me.TES_CV_Chg.Cmd, Me.TES_CV_Dis.Cmd, Me.TES_Interlock_Trip }
IF TES_Mode == 1 AND TES_Temp_Top.PV > 5.5 THEN
  TES_CV_Dis.Cmd = 0;
  IF TES_CV_Dis.ClosedFb == 1 THEN TES_CV_Chg.Cmd = 1; ENDIF;
ENDIF;
IF TES_Mode == 2 AND TES_Level.PV > 10 THEN
  TES_CV_Chg.Cmd = 0;
  IF TES_CV_Chg.ClosedFb == 1 THEN TES_CV_Dis.Cmd = 1; ENDIF;
ENDIF;
{ Break-before-make: idle or trip closes both valves }
IF TES_Mode == 0 OR TES_Interlock_Trip == 1 THEN
  TES_CV_Chg.Cmd = 0;
  TES_CV_Dis.Cmd = 0;
ENDIF;
`},
{g:'District Cooling',n:'CHW DP lead/lag pump ramp',l:'cs',c:`// Secondary CHW DP control. ArchestrA: Me.CHW_DP.PV, Me.CHW_DP_SP, Me.Lead_Speed, Me.Lag_Cmd
// InTouch Tag Dictionary: same names without the Me. prefix. Execute @ 1 s.
double err = Me.CHW_DP_SP - Me.CHW_DP.PV;
Me.Lead_Speed = Math.Max(Me.Min_Speed, Math.Min(100, Me.Lead_Speed + err * Me.Kp));
if (Me.Lead_Speed >= 95 && Me.Lag_Run_Fb == 0) { Me.Lag_Cmd = 1; }
if (Me.Lead_Speed <= 40 && Me.Lag_Run_Fb == 1) { Me.Lag_Cmd = 0; }
if (Me.Lag_Cmd == 1) { Me.Lag_Speed = Me.Lead_Speed; } else { Me.Lag_Speed = 0; }
`},
{g:'District Cooling',n:'Plant COP & chiller staging',l:'qs',c:`{ Plant COP = cooling kW / electrical kW. Staging on 10 min (600 s) delay, runs @ 1 s }
{ InTouch: DCP_Cooling_kW.PV, DCP_Elec_kW.PV, DCP_COP.PV, Chiller_Stage, Stage_Timer.PV }
{ ArchestrA: Me.DCP_Cooling_kW.PV, Me.DCP_Elec_kW.PV, Me.CH_Stage_Up_kW.PV, Me.CH_Stage_Dn_kW.PV }
IF DCP_Elec_kW.PV > 1 THEN
  DCP_COP.PV = DCP_Cooling_kW.PV / DCP_Elec_kW.PV;
ELSE
  DCP_COP.PV = 0;
ENDIF;
Stage_Timer.PV = Stage_Timer.PV + 1;
IF DCP_Cooling_kW.PV > CH_Stage_Up_kW.PV AND DCP_COP.PV > 3 AND Stage_Timer.PV >= 600 THEN
  Chiller_Stage = Chiller_Stage + 1;
  Stage_Timer.PV = 0;
ENDIF;
IF DCP_Cooling_kW.PV < CH_Stage_Dn_kW.PV AND Chiller_Stage > 1 AND Stage_Timer.PV >= 600 THEN
  Chiller_Stage = Chiller_Stage - 1;
  Stage_Timer.PV = 0;
ENDIF;
`},
{g:'Metals & Minerals',n:'Conveyor zero-speed/slip trip',l:'qs',c:`{ Belt slip: motor running but zero-speed switch shows stopped. Scan = 1 s. }
{ InTouch: CV_101_Run_Fb, CV_101_ZSS.Sw, CV_101_Slip_Timer.PV, CV_101_Slip_Trip, CV_101_Run_Cmd }
{ ArchestrA: Me.CV_101_Run_Fb, Me.CV_101_ZSS.Sw, Me.CV_101_Reset }
IF CV_101_Run_Fb == 1 AND CV_101_ZSS.Sw == 1 THEN
  CV_101_Slip_Timer.PV = CV_101_Slip_Timer.PV + 1;
ELSE
  CV_101_Slip_Timer.PV = 0;
ENDIF;
IF CV_101_Slip_Timer.PV >= 10 THEN
  CV_101_Slip_Trip = 1;
  CV_101_Run_Cmd = 0;
ENDIF;
IF CV_101_Reset == 1 THEN CV_101_Slip_Trip = 0; ENDIF;
`},
{g:'Metals & Minerals',n:'Jaw crusher lube oil trips',l:'cs',c:`// Lube oil high temp or low flow for 5 s trips the crusher. Execute @ 1 s.
// ArchestrA: Me.JC_Lube_Temp.PV (degC), Me.JC_Lube_Flow.PV (L/min), Me.JC_Trip, Me.JC_Run_Cmd
// InTouch: JC_Lube_Temp.PV, JC_Lube_Flow.PV, JC_Lube_Timer.PV, JC_Trip, JC_Run_Cmd
bool tempHi = Me.JC_Lube_Temp.PV > 65;
bool flowLo = Me.JC_Lube_Flow.PV < 8;
if (tempHi || flowLo) { Me.JC_Lube_Timer.PV += 1; } else { Me.JC_Lube_Timer.PV = 0; }
if (Me.JC_Lube_Timer.PV >= 5) { Me.JC_Trip = 1; Me.JC_Run_Cmd = 0; }
`},
{g:'Metals & Minerals',n:'Slurry pump auto-flush sequence',l:'qs',c:`{ Step 0 idle, 1 close discharge, 2 open flush water, 3 timed flush. Scan = 1 s. }
{ InTouch: SP_101_Run_Cmd, SP_101_Run_Fb, SP_101_Step.PV, SP_101_DV.Close, SP_101_DV.Closed_Fb, SP_101_FlushV.Open }
{ ArchestrA: Me.SP_101_Step.PV, Me.SP_101_DV.Close, Me.SP_101_FlushV.Open }
IF SP_101_Run_Cmd == 0 AND SP_101_Run_Fb == 1 AND SP_101_Step.PV == 0 THEN
  SP_101_Step.PV = 1;
ENDIF;
IF SP_101_Step.PV == 1 THEN
  SP_101_DV.Close = 1;
  IF SP_101_DV.Closed_Fb == 1 THEN SP_101_Step.PV = 2; ENDIF;
ENDIF;
IF SP_101_Step.PV == 2 THEN
  SP_101_FlushV.Open = 1;
  SP_101_Timer.PV = 0;
  SP_101_Step.PV = 3;
ENDIF;
IF SP_101_Step.PV == 3 THEN
  SP_101_Timer.PV = SP_101_Timer.PV + 1;
  IF SP_101_Timer.PV >= 30 THEN
    SP_101_FlushV.Open = 0;
    SP_101_Step.PV = 0;
  ENDIF;
ENDIF;
`},
{g:'Food & Beverage',n:'CIP 5-phase sequence timer',l:'qs',c:`{ Phases: 1 Rinse, 2 Caustic, 3 Rinse, 4 Acid, 5 Final rinse. Scan = 1 s. }
{ InTouch: CIP_Start, CIP_Phase.PV, CIP_Timer.PV, CIP_Dur_SP.PV (s), CIP_Water_V.Open, CIP_Caustic_V.Open, CIP_Acid_V.Open }
{ ArchestrA: Me.CIP_Phase.PV, Me.CIP_Timer.PV, Me.CIP_Complete. Use one duration per phase in production. }
IF CIP_Start == 1 AND CIP_Phase.PV == 0 THEN
  CIP_Phase.PV = 1;
  CIP_Timer.PV = 0;
  CIP_Complete = 0;
ENDIF;
IF CIP_Phase.PV > 0 THEN CIP_Timer.PV = CIP_Timer.PV + 1; ENDIF;
CIP_Water_V.Open = (CIP_Phase.PV == 1 OR CIP_Phase.PV == 3 OR CIP_Phase.PV == 5);
CIP_Caustic_V.Open = (CIP_Phase.PV == 2);
CIP_Acid_V.Open = (CIP_Phase.PV == 4);
IF CIP_Phase.PV > 0 AND CIP_Timer.PV >= CIP_Dur_SP.PV THEN
  CIP_Timer.PV = 0;
  CIP_Phase.PV = CIP_Phase.PV + 1;
ENDIF;
IF CIP_Phase.PV > 5 THEN
  CIP_Phase.PV = 0;
  CIP_Complete = 1;
ENDIF;
`},
{g:'Food & Beverage',n:'HTST divert valve interlock',l:'cs',c:`// Forward flow only if holding-tube temp >= setpoint; latched trip needs reset with temp OK.
// ArchestrA: Me.HT_Hold_Temp.PV, Me.HT_Hold_Temp_SP, Me.HT_Flow.PV, Me.HT_Divert_Fwd, Me.HT_Interlock_Trip
// InTouch: same names without Me.
bool tempOk = Me.HT_Hold_Temp.PV >= Me.HT_Hold_Temp_SP;
bool flowOk = Me.HT_Flow.PV >= Me.HT_Flow_Min_SP;
if (!tempOk) { Me.HT_Interlock_Trip = 1; }
if (Me.HT_Reset == 1 && tempOk) { Me.HT_Interlock_Trip = 0; }
Me.HT_Divert_Fwd = (tempOk && flowOk && Me.HT_Interlock_Trip == 0);
`},
{g:'Food & Beverage',n:'Batching tare & dosing ramp',l:'cs',c:`// Auto-tare when empty, then slow the dosing pump as the target weight nears.
// ArchestrA: Me.BV_LC.PV (kg gross), Me.BV_Tare, Me.BV_Target_SP, Me.BV_Preact_SP, Me.BV_Dose_Speed (%)
// InTouch: BV_LC.PV, BV_Tare, BV_Target_SP, BV_Preact_SP, BV_Dose_Speed, BV_Dose_Run, BV_Tare_Cmd
if (Me.BV_Tare_Cmd == 1 && Me.BV_Dose_Run == 0) { Me.BV_Tare = Me.BV_LC.PV; }
double net = Me.BV_LC.PV - Me.BV_Tare;
double rem = Me.BV_Target_SP - net;
double spd = 0;
if (Me.BV_Dose_Run == 1 && rem > 0) { spd = Math.Min(100, 20 + rem * 1.6); }
if (rem <= Me.BV_Preact_SP) { spd = 0; Me.BV_Done = 1; }
Me.BV_Dose_Speed = spd;
`}];
