/* ===========================================================================
   api.js — Comunicación entre el frontend (GitHub Pages) y el backend (Render)
   ===========================================================================
   Todas las llamadas pasan por aquí. Se encarga de:
   - Adjuntar el token de acceso en las escrituras.
   - Manejar los errores de red de forma uniforme.
   - Avisar cuando Render está "despertando" (el plan gratuito duerme el
     servicio tras 15 minutos sin uso y tarda ~1 minuto en revivir).
=========================================================================== */

const API = {
  // --- Token -------------------------------------------------------------
  obtenerToken() {
    return localStorage.getItem(CONFIG.CLAVE_TOKEN) || "";
  },

  guardarToken(token) {
    localStorage.setItem(CONFIG.CLAVE_TOKEN, token);
  },

  borrarToken() {
    localStorage.removeItem(CONFIG.CLAVE_TOKEN);
  },

  // --- Llamada genérica ---------------------------------------------------
  async peticion(ruta, opciones = {}) {
    const url = `${CONFIG.API_URL}${ruta}`;
    const cabeceras = opciones.headers || {};

    // El token solo se necesita para escribir (POST)
    if (opciones.method && opciones.method !== "GET") {
      cabeceras["X-API-Token"] = this.obtenerToken();
    }

    let respuesta;
    try {
      respuesta = await fetch(url, { ...opciones, headers: cabeceras });
    } catch (error) {
      throw new Error(
        "No se pudo contactar al servidor. Si es la primera visita del día, " +
        "Render puede tardar hasta un minuto en despertar: espera y reintenta."
      );
    }

    if (respuesta.status === 401) {
      this.borrarToken();
      throw new Error("Token inválido. Vuelve a ingresar la contraseña de acceso.");
    }

    if (!respuesta.ok) {
      let mensaje = `Error ${respuesta.status}`;
      try {
        const datos = await respuesta.json();
        mensaje = datos.error || mensaje;
      } catch (_) { /* la respuesta no era JSON */ }
      throw new Error(mensaje);
    }

    return respuesta;
  },

  async get(ruta) {
    const respuesta = await this.peticion(ruta);
    return respuesta.json();
  },

  async post(ruta, datos) {
    const respuesta = await this.peticion(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    return respuesta.json();
  },

  // Correcciones sobre un registro que ya existe (clientes e incidencias).
  // No crea uno nuevo: reemplaza los datos del que se indica en la ruta.
  async put(ruta, datos) {
    const respuesta = await this.peticion(ruta, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    return respuesta.json();
  },

  // Envío de archivos (evidencias). No lleva Content-Type: el navegador
  // lo pone solo, con el boundary correcto del multipart.
  async subirArchivos(ruta, archivos) {
    const formulario = new FormData();
    for (const archivo of archivos) {
      formulario.append("evidencias", archivo);
    }
    const respuesta = await this.peticion(ruta, {
      method: "POST",
      body: formulario,
    });
    return respuesta.json();
  },

  // Descarga del reporte Excel
  async descargarReporte(parametros) {
    const query = new URLSearchParams(parametros).toString();
    const respuesta = await this.peticion(`/api/reportes/generar?${query}`);

    const blob = await respuesta.blob();
    const cabecera = respuesta.headers.get("Content-Disposition") || "";
    const coincidencia = cabecera.match(/filename=([^;]+)/);
    const nombre = coincidencia
      ? coincidencia[1].replace(/"/g, "").trim()
      : "reporte.xlsx";

    // Truco estándar para forzar la descarga desde el navegador
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  },
};
