import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "facturas@tenden-c.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { invoice, items, toEmail, companyName, paymentInfo } = await req.json();

    if (!invoice || !toEmail) {
      return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const statusLabel: Record<string, string> = {
      pendiente: "Pendiente de pago",
      cobrado: "Pagado",
      vencida: "Vencida",
    };

    const statusColor: Record<string, string> = {
      pendiente: "#f59e0b",
      cobrado: "#10b981",
      vencida: "#ef4444",
    };

    const itemsRows = (items || []).map((item: any) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 12px; font-size: 14px; color: #334155;">${item.product || item.description || "Producto"}</td>
        <td style="padding: 10px 12px; font-size: 14px; color: #64748b; text-align: center;">${item.qty}</td>
        <td style="padding: 10px 12px; font-size: 14px; color: #64748b; text-align: right;">€${Number(item.price || 0).toFixed(2)}</td>
        <td style="padding: 10px 12px; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right;">€${Number(item.total || (item.qty * (item.price || 0))).toFixed(2)}</td>
      </tr>
    `).join("");

    const company = companyName || "Quickly";
    const statusText = statusLabel[invoice.status] || invoice.status;
    const statusBadgeColor = statusColor[invoice.status] || "#64748b";
    const totalAmount = Number(invoice.amount || 0).toFixed(2);

    // ── Sección de métodos de pago ──
    const pi = paymentInfo || {};
    const hasPayment = pi.bizum || pi.iban || pi.paypal || pi.stripe;
    const paymentSection = hasPayment ? `
    <div style="margin-bottom:28px;padding:24px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0f172a;">💳 Opciones de pago</p>
      <p style="margin:0 0 16px;font-size:13px;color:#64748b;">Importe: <strong>€${totalAmount}</strong> · Elige cómo pagar:</p>
      <table cellpadding="0" cellspacing="0">
        <tr>
          ${pi.bizum ? `<td style="padding-right:10px;padding-bottom:10px;">
            <a href="https://bizum.es" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:#0049e0;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
              📱 Bizum &nbsp;<strong>${pi.bizum}</strong>
            </a>
          </td>` : ''}
          ${pi.paypal ? `<td style="padding-right:10px;padding-bottom:10px;">
            <a href="${pi.paypal.startsWith('http') ? pi.paypal : 'https://' + pi.paypal}" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:#003087;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
              🅿️ PayPal
            </a>
          </td>` : ''}
          ${pi.stripe ? `<td style="padding-right:10px;padding-bottom:10px;">
            <a href="${pi.stripe}" style="display:inline-flex;align-items:center;gap:6px;padding:12px 20px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;">
              💳 Pagar con tarjeta →
            </a>
          </td>` : ''}
        </tr>
      </table>
      ${pi.iban ? `<div style="margin-top:12px;padding:12px;background:#fff;border-radius:8px;border:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#64748b;">🏦 Transferencia bancaria</p>
        <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#0f172a;font-family:monospace;">${pi.iban}</p>
      </div>` : ''}
    </div>` : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${invoice.invoice_number}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0; padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0; font-size:24px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">${company}</p>
                    <p style="margin:4px 0 0; font-size:14px; color:rgba(255,255,255,0.85);">Factura electrónica</p>
                  </td>
                  <td align="right">
                    <span style="background:rgba(255,255,255,0.2); color:#ffffff; padding: 6px 14px; border-radius:20px; font-size:13px; font-weight:600;">${invoice.invoice_number || "FAC-000"}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff; padding: 36px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 8px; font-size:18px; font-weight:700; color:#0f172a;">Hola, ${invoice.client} 👋</p>
              <p style="margin:0 0 28px; font-size:15px; color:#64748b; line-height:1.6;">
                Te enviamos el resumen de tu factura. Puedes revisar los detalles a continuación.
              </p>

              <!-- Invoice info cards -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="48%" style="background:#f8fafc; border-radius:12px; padding:16px 20px; border:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">Fecha emisión</p>
                    <p style="margin:0; font-size:15px; font-weight:600; color:#0f172a;">${invoice.date || "-"}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#f8fafc; border-radius:12px; padding:16px 20px; border:1px solid #e2e8f0;">
                    <p style="margin:0 0 4px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">Vencimiento</p>
                    <p style="margin:0; font-size:15px; font-weight:600; color:#0f172a;">${invoice.due_date || "-"}</p>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              ${itemsRows ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px; border: 1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding: 10px 12px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; text-align:left; letter-spacing:0.5px;">Concepto</th>
                    <th style="padding: 10px 12px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; text-align:center; letter-spacing:0.5px;">Cant.</th>
                    <th style="padding: 10px 12px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; text-align:right; letter-spacing:0.5px;">Precio</th>
                    <th style="padding: 10px 12px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; text-align:right; letter-spacing:0.5px;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsRows}</tbody>
              </table>
              ` : ""}

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 12px; font-size:14px; color:#64748b;">Subtotal</td>
                        <td style="padding: 6px 12px; font-size:14px; color:#0f172a; font-weight:600; min-width:80px; text-align:right;">€${Number(invoice.subtotal || invoice.amount || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 12px; font-size:14px; color:#64748b;">IVA</td>
                        <td style="padding: 6px 12px; font-size:14px; color:#0f172a; font-weight:600; text-align:right;">€${Number(invoice.tax || 0).toFixed(2)}</td>
                      </tr>
                      <tr style="border-top: 2px solid #e2e8f0;">
                        <td style="padding: 10px 12px; font-size:17px; font-weight:800; color:#0f172a;">TOTAL</td>
                        <td style="padding: 10px 12px; font-size:20px; font-weight:800; color:#f97316; text-align:right;">€${Number(invoice.amount || 0).toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Status badge -->
              <div style="text-align:center; margin-bottom:28px;">
                <span style="background:${statusBadgeColor}20; color:${statusBadgeColor}; padding: 8px 20px; border-radius:20px; font-size:13px; font-weight:700; border: 1px solid ${statusBadgeColor}40;">
                  ${statusText}
                </span>
              </div>

              <!-- Payment method -->
              ${invoice.payment_method ? `
              <div style="background:#f8fafc; border-radius:12px; padding:16px 20px; margin-bottom:28px; border:1px solid #e2e8f0;">
                <p style="margin:0 0 4px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">Método de pago</p>
                <p style="margin:0; font-size:15px; font-weight:600; color:#0f172a;">${invoice.payment_method}</p>
              </div>
              ` : ""}

              <!-- Notes -->
              ${invoice.notes ? `
              <div style="background:#fffbeb; border-radius:12px; padding:16px 20px; margin-bottom:28px; border:1px solid #fde68a;">
                <p style="margin:0 0 4px; font-size:11px; font-weight:600; color:#92400e; text-transform:uppercase; letter-spacing:0.5px;">Notas</p>
                <p style="margin:0; font-size:14px; color:#78350f; line-height:1.6;">${invoice.notes}</p>
              </div>
              ` : ""}

              <!-- Payment options -->
              ${paymentSection}

              <p style="margin:0; font-size:14px; color:#94a3b8; line-height:1.6;">
                Si tienes alguna pregunta sobre esta factura, responde a este email o contacta con nosotros.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9; border-radius: 0 0 16px 16px; padding: 24px 40px; text-align:center;">
              <p style="margin:0; font-size:13px; color:#94a3b8;">
                Este email fue enviado automáticamente por <strong style="color:#f97316;">${company}</strong>
              </p>
              <p style="margin:6px 0 0; font-size:12px; color:#cbd5e1;">© ${new Date().getFullYear()} ${company} · Todos los derechos reservados</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${company} Facturación <${FROM_EMAIL}>`,
        to: [toEmail],
        subject: `Factura ${invoice.invoice_number} — €${Number(invoice.amount || 0).toFixed(2)}`,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || "Error al enviar el email" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
