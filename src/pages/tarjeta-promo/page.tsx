import { useState } from 'react';

const PROMO_URL = 'https://app.tenden-c.com/promo';
const QR_API = (size: number) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(PROMO_URL)}&bgcolor=0d1017&color=f97316&qzone=1&format=png`;

const FEATURES = [
  { icon: 'ri-truck-line',           text: 'Camiones, trailers y furgonetas' },
  { icon: 'ri-route-line',           text: 'Rutas y seguimiento GPS' },
  { icon: 'ri-bill-line',            text: 'Facturas y albaranes digitales' },
  { icon: 'ri-box-3-line',           text: 'Cualquier tipo de mercancía' },
  { icon: 'ri-team-line',            text: 'Conductores y empleados' },
  { icon: 'ri-robot-line',           text: 'Asistente de IA integrado' },
];

type Layout = 'card' | 'flyer' | 'sheet';

export default function TarjetaPromo() {
  const [layout, setLayout] = useState<Layout>('card');
  const [copies, setCopies] = useState(8);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Header — oculto al imprimir */}
      <div className="no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Tarjeta Promocional</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Imprime y entrega a empresas · El QR activa 1 mes de Premium gratis
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 whitespace-nowrap self-start"
          >
            <i className="ri-printer-line text-lg" /> Imprimir tarjetas
          </button>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex flex-wrap gap-6 items-center">
          {/* Layout selector */}
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">Formato</p>
            <div className="flex gap-2">
              {([
                { id: 'card',  label: 'Tarjeta',  icon: 'ri-bank-card-line' },
                { id: 'flyer', label: 'Flyer',    icon: 'ri-file-text-line' },
                { id: 'sheet', label: 'Hoja x8',  icon: 'ri-layout-grid-line' },
              ] as { id: Layout; label: string; icon: string }[]).map(l => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all border
                    ${layout === l.id
                      ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-700/40'
                      : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                >
                  <i className={l.icon} /> {l.label}
                </button>
              ))}
            </div>
          </div>

          {layout === 'sheet' && (
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 font-medium uppercase tracking-wide">Copias por hoja</p>
              <select
                value={copies}
                onChange={e => setCopies(Number(e.target.value))}
                className="px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-slate-200 outline-none"
              >
                {[2, 4, 6, 8, 10].map(n => (
                  <option key={n} value={n}>{n} tarjetas</option>
                ))}
              </select>
            </div>
          )}

          {/* Info */}
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-400 dark:text-slate-500">URL del QR</p>
            <p className="text-sm font-mono text-orange-600 dark:text-orange-400">{PROMO_URL}</p>
          </div>
        </div>
      </div>

      {/* ─── PREVIEW AREA ──────────────────────────────────────────────────── */}

      {/* Tarjeta individual / Flyer */}
      {(layout === 'card' || layout === 'flyer') && (
        <div className={`no-print flex justify-center ${layout === 'flyer' ? 'py-4' : ''}`}>
          <SingleCard size={layout === 'flyer' ? 'flyer' : 'card'} />
        </div>
      )}

      {/* Hoja de 8 tarjetas */}
      {layout === 'sheet' && (
        <div className="no-print overflow-auto">
          <div
            className="mx-auto bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 p-4"
            style={{ width: '794px' }}
          >
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: copies }).map((_, i) => (
                <SingleCard key={i} size="card" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PRINT AREA (solo visible al imprimir) ────────────────────────── */}
      <div className="print-only">
        {layout === 'sheet' ? (
          <div className="grid grid-cols-2 gap-4" style={{ padding: '8mm' }}>
            {Array.from({ length: copies }).map((_, i) => (
              <PrintCard key={i} />
            ))}
          </div>
        ) : layout === 'flyer' ? (
          <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
            <PrintFlyer />
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ minHeight: '100vh' }}>
            <PrintCard />
          </div>
        )}
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-only, .print-only * { visibility: visible !important; }
          .no-print { display: none !important; }
          .print-only { position: fixed; left: 0; top: 0; width: 100%; }
          @page { margin: 0; size: A4; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Tarjeta preview (pantalla) ──────────────────────────────────────────── */
function SingleCard({ size }: { size: 'card' | 'flyer' }) {
  if (size === 'flyer') return <FlyerPreview />;
  return <CardPreview />;
}

function CardPreview() {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl select-none"
      style={{
        width: '340px',
        background: 'linear-gradient(135deg, #0d1017 0%, #111827 60%, #1a0a00 100%)',
        border: '1px solid rgba(249,115,22,0.25)',
      }}
    >
      {/* Franja superior */}
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)' }} />

      <div className="p-6">
        {/* Logo + nombre */}
        <div className="flex items-center gap-3 mb-5">
          <img src="/logo.png" alt="Quickly" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
          <div>
            <h2 className="text-2xl text-white font-bold leading-tight" style={{ fontFamily: 'Pacifico, cursive' }}>Quickly</h2>
            <p className="text-orange-400/70 text-xs">Transporte y logística universal</p>
          </div>
        </div>

        <div className="flex gap-5 items-center">
          {/* QR */}
          <div className="flex-shrink-0 p-2 rounded-xl bg-[#0d1017] border border-orange-500/20">
            <img
              src={QR_API(120)}
              alt="QR"
              className="w-[100px] h-[100px] rounded-lg"
              crossOrigin="anonymous"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full mb-3">
              <i className="ri-vip-crown-fill text-orange-400 text-xs" />
              <span className="text-orange-300 text-xs font-bold">1 MES PREMIUM GRATIS</span>
            </div>
            <p className="text-white text-sm font-semibold leading-snug mb-1">Escanea y activa ahora</p>
            <p className="text-slate-500 text-[10px] leading-relaxed">Sin tarjeta · Sin compromiso · Se bloquea automáticamente</p>
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-orange-500/60 text-[9px] font-mono break-all">app.tenden-c.com/promo</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-1.5">
          {FEATURES.map(f => (
            <div key={f.text} className="flex items-center gap-1 text-slate-500 text-[9px]">
              <i className={`${f.icon} text-orange-500/60 text-xs flex-shrink-0`} />
              <span className="truncate">{f.text.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlyerPreview() {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl select-none"
      style={{
        width: '380px',
        background: 'linear-gradient(160deg, #0d1017 0%, #111827 50%, #1a0800 100%)',
        border: '1px solid rgba(249,115,22,0.2)',
      }}
    >
      <div style={{ height: '4px', background: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)' }} />

      <div className="p-8 text-center">
        {/* Logo */}
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain" />
        <h1 className="text-4xl text-white font-bold mb-1" style={{ fontFamily: 'Pacifico, cursive' }}>Quickly</h1>
        <p className="text-orange-400/70 text-sm mb-6">Transporte y logística universal</p>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 rounded-full mb-6 shadow-lg shadow-orange-500/30">
          <i className="ri-vip-crown-fill text-white" />
          <span className="text-white font-bold text-sm">1 MES PREMIUM GRATIS</span>
        </div>

        {/* QR */}
        <div className="inline-block p-3 rounded-2xl bg-[#0d1017] border border-orange-500/20 mb-6 shadow-inner">
          <img src={QR_API(180)} alt="QR Code" className="w-[150px] h-[150px] rounded-xl" crossOrigin="anonymous" />
        </div>

        <p className="text-white font-semibold text-base mb-1">Escanea el código QR</p>
        <p className="text-slate-400 text-sm mb-6">y activa tu prueba gratuita al instante</p>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-2 text-left mb-6">
          {FEATURES.map(f => (
            <div key={f.text} className="flex items-center gap-2 text-xs text-slate-400">
              <i className={`${f.icon} text-orange-500 text-sm flex-shrink-0`} />
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        <p className="text-slate-600 text-[10px] mt-4">
          Sin tarjeta de crédito · Sin compromiso<br />
          La prueba se bloquea automáticamente al finalizar el mes
        </p>
        <p className="text-orange-500/40 text-[9px] font-mono mt-2">app.tenden-c.com/promo</p>
      </div>
    </div>
  );
}

/* ── Versiones de impresión (colores sólidos para impresoras) ─────────────── */
function PrintCard() {
  return (
    <div style={{
      width: '85mm', height: '54mm', borderRadius: '4mm', overflow: 'hidden',
      background: '#0d1017', border: '1px solid #f97316', pageBreakInside: 'avoid',
      fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: '3px', background: 'linear-gradient(90deg,#f97316,#fb923c)' }} />
      <div style={{ padding: '5mm', flex: 1, display: 'flex', gap: '4mm', alignItems: 'center' }}>
        {/* QR */}
        <div style={{ flexShrink: 0, padding: '2mm', background: '#0d1017', border: '0.5px solid rgba(249,115,22,0.4)', borderRadius: '3mm' }}>
          <img src={QR_API(110)} alt="QR" style={{ width: '22mm', height: '22mm' }} />
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '5.5mm', fontWeight: 800, color: '#ffffff', marginBottom: '1mm', fontFamily: 'Pacifico, cursive' }}>Quickly</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1mm', padding: '0.5mm 2mm', background: 'rgba(249,115,22,0.2)', border: '0.5px solid rgba(249,115,22,0.4)', borderRadius: '10mm', marginBottom: '1.5mm' }}>
            <span style={{ fontSize: '2.5mm', color: '#fb923c', fontWeight: 700 }}>★ 1 MES PREMIUM GRATIS</span>
          </div>
          <div style={{ fontSize: '2.8mm', color: '#e2e8f0', fontWeight: 600, marginBottom: '0.5mm' }}>Escanea y activa ahora</div>
          <div style={{ fontSize: '2.2mm', color: '#64748b' }}>Sin tarjeta · Sin compromiso</div>
          <div style={{ fontSize: '2mm', color: 'rgba(249,115,22,0.5)', fontFamily: 'monospace', marginTop: '1mm' }}>app.tenden-c.com/promo</div>
        </div>
      </div>
    </div>
  );
}

function PrintFlyer() {
  return (
    <div style={{
      width: '148mm', minHeight: '200mm', borderRadius: '6mm', overflow: 'hidden',
      background: '#0d1017', border: '1px solid rgba(249,115,22,0.3)',
      fontFamily: 'system-ui, sans-serif', textAlign: 'center',
    }}>
      <div style={{ height: '5px', background: 'linear-gradient(90deg,#f97316,#fb923c,#fdba74)' }} />
      <div style={{ padding: '10mm' }}>
        {/* Logo */}
        <div style={{ width: '20mm', height: '20mm', margin: '0 auto 4mm', borderRadius: '5mm', overflow: 'hidden', background: '#111827' }}>
          <img src="/logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: '10mm', fontWeight: 800, color: '#fff', fontFamily: 'Pacifico, cursive', marginBottom: '2mm' }}>Quickly</div>
        <div style={{ fontSize: '3.5mm', color: '#f97316', marginBottom: '8mm' }}>Transporte y logística universal</div>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2mm', padding: '2mm 6mm', background: '#f97316', borderRadius: '10mm', marginBottom: '7mm' }}>
          <span style={{ fontSize: '4mm', color: '#fff', fontWeight: 700 }}>★ 1 MES PREMIUM GRATIS</span>
        </div>

        {/* QR */}
        <div style={{ display: 'inline-block', padding: '4mm', background: '#0d1017', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '5mm', marginBottom: '6mm' }}>
          <img src={QR_API(220)} alt="QR" style={{ width: '44mm', height: '44mm' }} />
        </div>

        <div style={{ fontSize: '4.5mm', fontWeight: 700, color: '#fff', marginBottom: '1.5mm' }}>Escanea el código QR</div>
        <div style={{ fontSize: '3.5mm', color: '#94a3b8', marginBottom: '8mm' }}>y activa tu prueba gratuita al instante</div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', textAlign: 'left', marginBottom: '7mm' }}>
          {FEATURES.map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '1.5mm', fontSize: '2.8mm', color: '#94a3b8' }}>
              <span style={{ color: '#f97316', flexShrink: 0 }}>●</span> {f.text}
            </div>
          ))}
        </div>

        <div style={{ fontSize: '2.5mm', color: '#475569', borderTop: '0.5px solid rgba(249,115,22,0.1)', paddingTop: '4mm' }}>
          Sin tarjeta de crédito · La prueba se desactiva automáticamente al finalizar el mes
        </div>
        <div style={{ fontSize: '2.2mm', color: 'rgba(249,115,22,0.4)', fontFamily: 'monospace', marginTop: '2mm' }}>
          app.tenden-c.com/promo
        </div>
      </div>
    </div>
  );
}
