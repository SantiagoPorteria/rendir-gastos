export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const base = url.searchParams.get('base') || 'CLP';

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/${base}`
    );
    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
