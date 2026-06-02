export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { base64, mediaType } = await req.json();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `Analiza este comprobante/boleta chilena. Responde ÚNICAMENTE con JSON válido sin backticks:
{"comercio":"string","rut_comercio":"XX.XXX.XXX-X o null","monto_total":número o null,"monto_neto":número o null,"iva":número o null,"fecha":"YYYY-MM-DD o null","tipo_documento":"boleta|factura|ticket|recibo|otro","numero_documento":"string o null","descripcion":"máx 8 palabras","categoria_sugerida":"Bencina|Almuerzos|Gastos Oficina|Peajes|Estacionamientos|Supermercado|Restaurantes|Clientes|Merchandising|Eventos|Otro","confianza":"alta|media|baja"}` }
        ]
      }]
    })
  });

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
