import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL    = Deno.env.get("FROM_EMAIL") || "noreply@resend.dev";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const { to, subject, body, companyName } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: to, subject" }),
        { status: 400, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY no configurado en Supabase secrets" }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    const company = companyName || "Quickly";

    // Convertir saltos de línea en párrafos HTML
    const htmlBody = (body || "")
      .split("\n")
      .filter((l: string) => l.trim())
      .map((l: string) => `<p style="margin:0 0 12px; font-size:15px; color:#374151; line-height:1.6;">${l}</p>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);border-radius:16px 16px 0 0;padding:28px 36px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#fff;">${company}</p>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Correo electrónico</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:32px 36px;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#111827;">
                ${subject}
              </p>
              ${htmlBody || '<p style="color:#6b7280;">Sin contenido.</p>'}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 20px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Enviado desde <strong style="color:#f97316;">${company}</strong> · Panel de Gestión
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${company} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await resendRes.json();

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: data.message || "Error al enviar el email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...cors } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
});
