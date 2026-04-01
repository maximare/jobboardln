// app/api/apify/route.js
// Ovaj endpoint prima zahteve od frontend-a i prosleđuje ih Apify API-ju
// Pošto ide server → server, nema CORS problema

export async function POST(request) {
  try {
    const { path, body } = await request.json();

    const apifyUrl = `https://api.apify.com${path}`;

    const resp = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return Response.json(
        { error: data?.error?.message || `Apify greška: HTTP ${resp.status}` },
        { status: resp.status }
      );
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) return Response.json({ error: "Nedostaje path" }, { status: 400 });

    const apifyUrl = `https://api.apify.com${path}`;
    const resp = await fetch(apifyUrl);
    const data = await resp.json();

    if (!resp.ok) {
      return Response.json(
        { error: data?.error?.message || `Apify greška: HTTP ${resp.status}` },
        { status: resp.status }
      );
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
