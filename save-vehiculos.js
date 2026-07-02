// netlify/functions/save-vehiculos.js
//
// Recibe el catálogo completo desde el panel admin y lo commitea
// al repo de GitHub (data/vehiculos.json). Ese commit dispara
// automáticamente el redeploy en Netlify, así que la página pública
// termina actualizada sin que nadie toque nada manualmente.
//
// Variables de entorno necesarias en Netlify (Site settings > Environment variables):
//   GITHUB_TOKEN   -> Personal Access Token de GitHub (permiso "repo" o "Contents: Read and write")
//   GITHUB_OWNER   -> tu usuario, ej: sancheznicolase10-bit
//   GITHUB_REPO    -> nombre del repo, ej: nscarsgarage
//   GITHUB_BRANCH  -> rama, normalmente "main" (opcional, default "main")
//   ADMIN_TOKEN    -> la misma clave del panel admin (o una distinta), para que nadie
//                     que no sea vos pueda pegarle a este endpoint directamente

const GITHUB_API = "https://api.github.com";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "JSON inválido" };
  }

  const { vehiculos, token } = body;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return { statusCode: 401, body: "No autorizado" };
  }

  if (!Array.isArray(vehiculos)) {
    return { statusCode: 400, body: "Formato inválido: se esperaba un array de vehículos" };
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return { statusCode: 500, body: "Faltan variables de entorno de GitHub en Netlify" };
  }

  const branch = GITHUB_BRANCH || "main";
  const path = "data/vehiculos.json";
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
  };

  try {
    // 1. Conseguir el SHA actual del archivo (GitHub lo exige para poder actualizarlo)
    let sha;
    const getRes = await fetch(`${url}?ref=${branch}`, { headers });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    }
    // Si el archivo todavía no existe (404), sha queda undefined y GitHub lo crea de cero.

    // 2. Commitear el archivo actualizado
    const content = Buffer.from(JSON.stringify(vehiculos, null, 2)).toString("base64");
    const putRes = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Actualización de catálogo · ${new Date().toISOString()}`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return { statusCode: putRes.status, body: `Error de GitHub: ${errText}` };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: `Error interno: ${err.message}` };
  }
};
