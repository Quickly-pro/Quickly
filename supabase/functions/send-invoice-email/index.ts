import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invoice, items, toEmail, companyName, paymentInfo } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev';

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fmt = (n: number) =>
      new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

    const itemsRows = (items || []).map((item: any) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">${item.description || item.name || 'Producto'}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:center;">${item.quantity || 1}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;">${fmt(item.unit_price || item.price || 0)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;font-weight:600;">${fmt((item.quantity || 1) * (item.unit_price || item.price || 0))}</td>
      </tr>`).join('');

    // Build payment buttons
    const paymentButtonsArr: string[] = [];
    if (paymentInfo?.bizum) {
      paymentButtonsArr.push(`<td style="padding-right:8px;padding-bottom:8px;">
        <table cellpadding="0" cellspacing="0"><tr><td style="background:#1e3a5f;border-radius:10px;padding:12px 20px;">
          <a href="tel:${paymentInfo.bizum}" style="color:#fff;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;">📱 Bizum ${paymentInfo.bizum}</a>
        </td></tr></table></td>`);
    }
    if (paymentInfo?.paypal) {
      const paypalHref = String(paymentInfo.paypal).startsWith('http') ? paymentInfo.paypal : `https://paypal.me/${paymentInfo.paypal}`;
      paymentButtonsArr.push(`<td style="padding-right:8px;padding-bottom:8px;">
        <table cellpadding="0" cellspacing="0"><tr><td style="background:#003087;border-radius:10px;padding:12px 20px;">
          <a href="${paypalHref}" style="color:#fff;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;"><span style="color:#009cde;">Pay</span><span style="color:#fff;">Pal</span></a>
        </td></tr></table></td>`);
    }
    if (paymentInfo?.stripe) {
      paymentButtonsArr.push(`<td style="padding-bottom:8px;">
        <table cellpadding="0" cellspacing="0"><tr><td style="background:#f97316;border-radius:10px;padding:12px 20px;">
          <a href="${paymentInfo.stripe}" style="color:#fff;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;">Pagar con tarjeta →</a>
        </td></tr></table></td>`);
    }
    const paymentButtons = paymentButtonsArr.join('');
    const ibanBlock = paymentInfo?.iban ? `
      <div style="margin-top:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">
        <span style="color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Transferencia bancaria · IBAN:</span>
        <div style="color:#111827;font-size:14px;font-weight:700;margin-top:4px;font-family:monospace;">${paymentInfo.iban}</div>
      </div>` : '';

    const subtotal = invoice.subtotal ?? invoice.total ?? 0;
    const tax = invoice.tax ?? 0;
    const total = invoice.total ?? subtotal;

    const invoiceDate = invoice.date
      ? new Date(invoice.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const dueDate = invoice.due_date
      ? new Date(invoice.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : '';

    const statusColors: Record<string, string> = { paid: '#10b981', pending: '#f59e0b', overdue: '#ef4444' };
    const statusLabels: Record<string, string> = { paid: 'Pagada', pending: 'Pendiente', overdue: 'Vencida' };
    const statusColor = statusColors[invoice.status] || '#f59e0b';
    const statusLabel = statusLabels[invoice.status] || 'Pendiente';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Factura ${invoice.invoice_number}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header marca -->
  <tr><td style="background:#fff;border-radius:16px 16px 0 0;padding:24px 40px;border-bottom:3px solid #f97316;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="color:#f97316;font-size:22px;font-weight:800;">${companyName || 'Empresa'}</div>
        <div style="color:#9ca3af;font-size:12px;margin-top:2px;">Factura electrónica</div>
      </td>
      <td align="right">
        <span style="background:#fff7ed;color:#f97316;font-size:13px;font-weight:700;padding:6px 16px;border-radius:20px;border:1.5px solid #fed7aa;">${invoice.invoice_number}</span>
      </td>
    </tr></table>
  </td></tr>

  <!-- Saludo -->
  <tr><td style="background:#fff;padding:28px 40px 12px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <div style="color:#111827;font-size:20px;font-weight:700;">Hola, ${invoice.client || 'Cliente'} 👋</div>
    <p style="color:#6b7280;font-size:14px;margin:8px 0 0;line-height:1.6;">Te enviamos el resumen de tu factura. Puedes revisar los detalles a continuación.</p>
  </td></tr>

  <!-- Fechas -->
  <tr><td style="background:#fff;padding:16px 40px 20px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;">
        <div style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">FECHA EMISIÓN</div>
        <div style="color:#111827;font-size:15px;font-weight:700;">${invoiceDate}</div>
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;">
        <div style="color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">VENCIMIENTO</div>
        <div style="color:#111827;font-size:15px;font-weight:700;">${dueDate || invoiceDate}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- Tabla de items -->
  <tr><td style="background:#fff;padding:0 40px 20px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:11px 16px;text-align:left;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Concepto</th>
        <th style="padding:11px 16px;text-align:center;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Cant.</th>
        <th style="padding:11px 16px;text-align:right;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Precio</th>
        <th style="padding:11px 16px;text-align:right;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">Total</th>
      </tr></thead>
      <tbody>
        ${itemsRows || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">Sin líneas de detalle</td></tr>'}
      </tbody>
    </table>
  </td></tr>

  <!-- Totales + estado -->
  <tr><td style="background:#fff;padding:0 40px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="50%" style="vertical-align:bottom;">
        <span style="background:${statusColor}20;color:${statusColor};font-size:12px;font-weight:700;padding:7px 18px;border-radius:20px;border:1.5px solid ${statusColor}50;">${statusLabel}</span>
      </td>
      <td width="50%">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${tax > 0 ? `
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Subtotal:</td>
            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${fmt(subtotal)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#6b7280;font-size:13px;">IVA (${invoice.tax_rate ?? 21}%):</td>
            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${fmt(tax)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:10px 0 0;border-top:2px solid #e5e7eb;">
              <span style="color:#111827;font-size:16px;font-weight:800;">TOTAL</span>
            </td>
            <td style="padding:10px 0 0;border-top:2px solid #e5e7eb;text-align:right;">
              <span style="color:#f97316;font-size:22px;font-weight:800;">${fmt(total)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr></table>
  </td></tr>

  <!-- Botones de pago -->
  ${paymentButtons || ibanBlock ? `
  <tr><td style="background:#f9fafb;padding:20px 40px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-top:1px solid #e5e7eb;">
    <div style="color:#111827;font-size:14px;font-weight:700;margin-bottom:4px;">Opciones de pago</div>
    <div style="color:#9ca3af;font-size:12px;margin-bottom:16px;">Importe: ${fmt(total)} · Elige cómo pagar:</div>
    ${paymentButtons ? `<table cellpadding="0" cellspacing="0"><tr>${paymentButtons}</tr></table>` : ''}
    ${ibanBlock}
  </td></tr>` : ''}

  <!-- Notas -->
  ${invoice.notes ? `
  <tr><td style="background:#fff;padding:16px 40px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <div style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">NOTAS</div>
    <p style="color:#374151;font-size:13px;line-height:1.6;margin:0;">${invoice.notes}</p>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="background:#f3f4f6;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">Email enviado automáticamente por <strong style="color:#f97316;">${companyName}</strong></p>
    <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">Para consultas, contacta directamente con la empresa.</p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `Factura ${invoice.invoice_number} - ${companyName}`,
        html,
      }),
    });

    const result = await emailRes.json();

    if (!emailRes.ok) {
      return new Response(JSON.stringify({ error: result?.message || 'Error Resend' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error inesperado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
