export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { base64, mediaType } = await req.json();

  // Normalize media type - API only accepts jpeg, png, gif, webp
  let normalizedType = mediaType;
  if (!['image/jpeg','image/png','image/gif','image/webp'].includes(mediaType)) {
    normalizedType = 'image/jpeg';
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: normalizedType, data: base64 } },
          { type: 'text', text: 'Analiza este comprobante/boleta chilena. Responde ÚNICAMENTE con JSON válido sin backticks: {"comercio":"string","rut_comercio":"XX.XXX.XXX-X o null","monto_total":numero o null,"monto_neto":numero o null,"iva":numero o null,"fecha":"YYYY-MM-DD o null","tipo_documento":"boleta|factura|ticket|recibo|otro","numero_documento":"string o null","descripcion":"max 8 palabras","categoria_sugerida":"Bencina|Almuerzos|Gastos Oficina|Peajes|Estacionamientos|Supermercado|Restaurantes|Clientes|Merchandising|Eventos|Otro","confianza":"alta|media|baja"}' }
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
