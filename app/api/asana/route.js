// app/api/asana/route.js
import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "x-asana-token, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const token = request.headers.get("x-asana-token");

  if (!path)  return NextResponse.json({ error: "Missing path" },  { status: 400, headers: CORS });
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401, headers: CORS });

  try {
    const res = await fetch(`https://app.asana.com/api/1.0${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502, headers: CORS });
  }
}
