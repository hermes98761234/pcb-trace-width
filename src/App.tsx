import { useEffect, useState } from 'react'
import { tr, N, type T } from './i18n'
import { DEFAULTS, loadState, PRESETS, saveState, type AppState, type Mode } from './lib/state'
import {
  currentCurve, currentForWidth, MIL_MM, minSpacing, ozToUm, riseForCurrent, traceResistance, viaAreaMil2, viaCurrent,
  viaResistance, widthForCurrent, type TraceParams, type ViaParams,
} from './lib/pcb'
import NumberField from './components/NumberField'
import Chart from './components/Chart'

const OZ = [0.5, 1, 2, 3, 4]
const COLORS = ['#a855f7', '#2563eb', '#16a34a', '#ea580c']
const TABLES = [
  ['B1', N('B1: internal conductors')],
  ['B2', N('B2: external, uncoated, up to 3050 m')],
  ['B3', N('B3: external, uncoated, above 3050 m')],
  ['B4', N('B4: external, with permanent polymer coating')],
  ['A5', N('A5: external, conformal coating over assembly')],
  ['A6', N('A6: component lead or land, uncoated, sea level')],
] as const

const sig = (v: number, d = 3) => (Number.isFinite(v) ? String(Number(v.toPrecision(d))) : '–')

export default function App() {
  const [s, setS] = useState<AppState>(loadState)
  const t: T = (str, ...a) => tr(s.lang, str, ...a)
  const set = (patch: Partial<AppState>) => setS((p) => ({ ...p, ...patch }))

  useEffect(() => saveState(s), [s])
  useEffect(() => {
    const root = document.documentElement
    if (s.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = s.theme
    root.lang = s.lang
  }, [s.theme, s.lang])

  const wf = s.imperial ? MIL_MM : 1 // mm per displayed width unit
  const wu = t(s.imperial ? 'mil' : 'mm')
  const lf = s.imperial ? 25.4 : 1 // mm per displayed length unit
  const lu = t(s.imperial ? 'in' : 'mm')
  const pf = s.imperial ? 25.4 : 1 // µm per displayed plating unit
  const pu = s.imperial ? t('mil') : t('µm')

  const thicknessUm = ozToUm(s.oz)
  const params: TraceParams = { standard: s.standard, layer: s.layer, thicknessUm, plane: s.plane }

  const r = (() => {
    const widthMm = s.mode === 'width' ? widthForCurrent(s.current, s.rise, params) : s.widthMm
    const current = s.mode === 'current' ? currentForWidth(s.widthMm, s.rise, params) : s.current
    const rise = s.mode === 'rise' ? riseForCurrent(s.current, s.widthMm, params) : s.rise
    const temp = s.ambient + rise
    const ohm = traceResistance(s.lengthMm, widthMm, thicknessUm, temp)
    const area = (widthMm * thicknessUm) / 1000
    return { widthMm, current, rise, temp, ohm, vdrop: current * ohm, power: current * current * ohm, area }
  })()

  const via: ViaParams = { holeMm: s.holeMm, platingUm: s.platingUm, lengthMm: s.boardMm, count: s.viaCount }
  const viaOne = viaCurrent({ ...via, count: 1 }, s.rise)
  const viaNeeded = Math.max(1, Math.ceil(r.current / viaOne - 1e-9))

  const spacing = minSpacing(s.voltage, s.table)

  const xMaxMm = Math.max(r.widthMm * 2, 0.5)
  const widths = Array.from({ length: 41 }, (_, i) => (xMaxMm * i) / 40)
  const series = OZ.slice(0, 4).map((oz, i) => ({
    label: `${oz} oz`,
    color: COLORS[i],
    pts: currentCurve(widths, s.rise, { ...params, thicknessUm: ozToUm(oz) }).map((c, j) => [widths[j], c] as [number, number]),
  }))

  const warnings: string[] = []
  if (r.temp > 105) warnings.push(t('Above about 105 °C the board laminate (FR-4 Tg) is at risk.'))
  if (s.rise < 1 || s.rise > 100 || r.rise > 100) warnings.push(t('Rise is outside the 1–100 °C range of the IPC data.'))

  const mmLabel = (mm: number) => (s.imperial ? `${sig(mm / MIL_MM)} ${t('mil')} (${sig(mm)} ${t('mm')})` : `${sig(mm)} ${t('mm')} (${sig(mm / MIL_MM)} ${t('mil')})`)

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('PCB trace width calculator')}</span>
        <span className="hint">{t('IPC-2221 and IPC-2152 current capacity, resistance, vias and spacing.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="section">
              <h3>{t('Presets')}</h3>
              <div className="row">
                {PRESETS.map((p) => (
                  <button key={p.name} className="small" onClick={() => set(p.patch)}>{t(p.name)}</button>
                ))}
              </div>
            </div>
            <div className="section">
              <h3>{t('Trace')}</h3>
              <div className="field">
                <label>{t('Solve')}</label>
                <select value={s.mode} onChange={(e) => set({ mode: e.target.value as Mode })}>
                  <option value="width">{t('Width for a current')}</option>
                  <option value="current">{t('Current for a width')}</option>
                  <option value="rise">{t('Temperature rise for both')}</option>
                </select>
              </div>
              <div className="grid2">
                <div className="field">
                  <label>{t('Standard')}</label>
                  <select value={s.standard} onChange={(e) => set({ standard: e.target.value as AppState['standard'] })}>
                    <option value="2221">{t('IPC-2221 (formula)')}</option>
                    <option value="2152">{t('IPC-2152 (approx.)')}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('Layer')}</label>
                  <select value={s.layer} onChange={(e) => set({ layer: e.target.value as AppState['layer'] })}>
                    <option value="external">{t('External')}</option>
                    <option value="internal">{t('Internal')}</option>
                  </select>
                </div>
              </div>
              {s.standard === '2152' && (
                <>
                  <div className="row">
                    <input id="plane" type="checkbox" checked={s.plane} onChange={(e) => set({ plane: e.target.checked })} />
                    <label htmlFor="plane">{t('Copper plane next to the trace')}</label>
                  </div>
                  <p className="hint">{t('IPC-2152 only: a plane conducts heat away and raises the allowed current.')}</p>
                </>
              )}
              <div className="grid2">
                {s.mode !== 'current' && <NumberField label={t('Current')} unit={t('A')} value={s.current} onChange={(v) => set({ current: v })} />}
                {s.mode !== 'rise' && <NumberField label={t('Temperature rise')} unit={t('°C')} value={s.rise} onChange={(v) => set({ rise: v })} />}
                {s.mode !== 'width' && <NumberField label={t('Trace width')} unit={wu} factor={wf} value={s.widthMm} onChange={(v) => set({ widthMm: v })} />}
                <div className="field">
                  <label>{t('Copper weight')} ({t('oz/ft²')})</label>
                  <select value={s.oz} onChange={(e) => set({ oz: Number(e.target.value) })}>
                    {(OZ.includes(s.oz) ? OZ : [...OZ, s.oz]).map((o) => (
                      <option key={o} value={o}>{o} oz ({sig(ozToUm(o), 3)} µm)</option>
                    ))}
                  </select>
                </div>
                <NumberField label={t('Ambient temperature')} unit={t('°C')} value={s.ambient} onChange={(v) => set({ ambient: v })} />
                <NumberField label={t('Length')} unit={lu} factor={lf} value={s.lengthMm} onChange={(v) => set({ lengthMm: v })} />
              </div>
            </div>
            <div className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid3">
                <div className="field">
                  <label>{t('Units')}</label>
                  <select value={s.imperial ? 'i' : 'm'} onChange={(e) => set({ imperial: e.target.value === 'i' })}>
                    <option value="m">{t('Metric (mm)')}</option>
                    <option value="i">{t('Imperial (mil)')}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('Theme')}</label>
                  <select value={s.theme} onChange={(e) => set({ theme: e.target.value as AppState['theme'] })}>
                    <option value="auto">{t('System')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('Language')}</label>
                  <select value={s.lang} onChange={(e) => set({ lang: e.target.value as AppState['lang'] })}>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </div>
              </div>
              <button className="small" onClick={() => setS({ ...DEFAULTS, lang: s.lang, theme: s.theme, imperial: s.imperial })}>↺ {t('Reset')}</button>
            </div>
          </div>
        </aside>
        <main className="main">
          <section className="box">
            <h3>{t('Result')}</h3>
            <p className="verdict ok">
              {s.mode === 'width' && `${t('Minimum trace width')}: ${mmLabel(r.widthMm)}`}
              {s.mode === 'current' && `${t('Maximum current')}: ${sig(r.current)} ${t('A')}`}
              {s.mode === 'rise' && `${t('Resulting temperature rise')}: ${sig(r.rise)} ${t('°C')}`}
            </p>
            {warnings.map((w) => <p key={w} className="warn-text">{w}</p>)}
            <table className="data">
              <tbody>
                <tr><td>{t('Trace width needed')}</td><td>{mmLabel(r.widthMm)}</td></tr>
                <tr><td>{t('Current')}</td><td>{sig(r.current)} {t('A')}</td></tr>
                <tr><td>{t('Temperature rise')}</td><td>{sig(r.rise)} {t('°C')}</td></tr>
                <tr><td>{t('Trace temperature')}</td><td>{sig(r.temp)} {t('°C')}</td></tr>
                <tr><td>{t('Cross-section')}</td><td>{sig(r.area, 3)} {t('mm')}² · {sig(r.area / (MIL_MM * MIL_MM), 3)} {t('mil')}²</td></tr>
                <tr><td>{t('Copper thickness')}</td><td>{sig(thicknessUm)} µm ({sig(thicknessUm / 25.4)} {t('mil')})</td></tr>
                <tr><td>{t('Resistance')}</td><td>{sig(r.ohm * 1000)} m&Omega; ({t('at {0} °C', sig(r.temp, 3))})</td></tr>
                <tr><td>{t('Voltage drop')}</td><td>{sig(r.vdrop * 1000)} mV</td></tr>
                <tr><td>{t('Power loss')}</td><td>{sig(r.power * 1000)} mW</td></tr>
              </tbody>
            </table>
          </section>
          <section className="box">
            <h3>{t('Current vs trace width')}</h3>
            <Chart series={series} marker={[r.widthMm, r.current]} xFactor={wf} xUnit={wu} t={t} />
          </section>
          <div className="two">
            <section className="box">
              <h3>{t('Vias')}</h3>
              <div className="grid2">
                <NumberField label={t('Finished hole diameter')} unit={wu} factor={wf} value={s.holeMm} onChange={(v) => set({ holeMm: v })} />
                <NumberField label={t('Plating thickness')} unit={pu} factor={pf} value={s.platingUm} onChange={(v) => set({ platingUm: v })} />
                <NumberField label={t('Board thickness')} unit={wu} factor={wf} value={s.boardMm} onChange={(v) => set({ boardMm: v })} />
                <NumberField label={t('Number of vias in parallel')} step={1} value={s.viaCount} onChange={(v) => set({ viaCount: Math.max(1, Math.round(v)) })} />
              </div>
              <table className="data">
                <tbody>
                  <tr><td>{t('Via barrel area')}</td><td>{sig(viaAreaMil2(via))} {t('mil')}²</td></tr>
                  <tr><td>{t('Current per via')}</td><td>{sig(viaOne)} {t('A')}</td></tr>
                  <tr><td>{t('Current capacity')}</td><td>{sig(viaCurrent(via, s.rise))} {t('A')}</td></tr>
                  <tr><td>{t('Resistance')}</td><td>{sig(viaResistance(via, s.ambient + s.rise) * 1000)} m&Omega;</td></tr>
                  <tr><td>{t('Needed for {0} A', sig(r.current))}</td><td>{viaNeeded} {t('vias needed')}</td></tr>
                </tbody>
              </table>
            </section>
            <section className="box">
              <h3>{t('Spacing')}</h3>
              <NumberField label={t('Voltage between conductors')} unit={t('V')} value={s.voltage} onChange={(v) => set({ voltage: v })} />
              <p className="hint">{t('DC or AC peak.')}</p>
              <div className="field">
                <label>{t('Environment (IPC-2221 Table 6-1)')}</label>
                <select value={s.table} onChange={(e) => set({ table: e.target.value })}>
                  {TABLES.map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}
                </select>
              </div>
              <p className="verdict ok">{t('Minimum spacing')}: {mmLabel(spacing)}</p>
            </section>
          </div>
        </main>
      </div>
      <p className="hint foot">
        {t('Results are estimates. IPC-2152 here is a chart approximation; verify critical designs.')}{' '}
        <a href="https://github.com/hermes98761234/pcb-trace-width">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
