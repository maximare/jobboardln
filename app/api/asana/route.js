// app/api/asana/route.js
// Asana CORS proxy — prosleđuje GET zahteve ka Asana API-ju

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const token = request.headers.get("x-asana-token");

  if (!path) {
    return Response.json({ error: "Missing path param" }, { status: 400 });
  }
  if (!token) {
    return Response.json({ error: "Missing x-asana-token header" }, { status: 401 });
  }

  const asanaUrl = `https://app.asana.com/api/1.0${path}`;

  try {
    const res = await fetch(asanaUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const data = await res.json();

    return Response.json(data, {
      status: res.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "x-asana-token, Content-Type",
    },
  });
}
