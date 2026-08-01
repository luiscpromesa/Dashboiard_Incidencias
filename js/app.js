/* ===========================================================================
   app.js — Lógica del frontend
   ===========================================================================
   Se encarga de:
   - Pedir la contraseña de acceso y guardarla en el navegador.
   - Navegar entre secciones.
   - Llenar los formularios con los catálogos que devuelve el backend.
   - Dibujar el dashboard (KPIs, gráficas Plotly y tabla de detalle).
   - Enviar servicios, incidencias y evidencias al backend.
   - Descargar los reportes en Excel.
=========================================================================== */

let CATALOGOS = {};       // Gravedades, colores, tipos de servicio, etc.
let CLIENTES = [];
let TIPOS = [];
let SERVICIOS = [];
let OPCIONES_REPORTE = {};

// ---------------------------------------------------------------------------
// Utilidades de interfaz
// ---------------------------------------------------------------------------
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function avisar(mensaje, tipo = "success") {
  const contenedor = $("#avisos");
  const alerta = document.createElement("div");
  alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
  alerta.innerHTML = `${mensaje}
    <button class="btn-close" data-bs-dismiss="alert"></button>`;
  contenedor.appendChild(alerta);
  // Los avisos de éxito se van solos a los 6 segundos
  if (tipo === "success") setTimeout(() => alerta.remove(), 6000);
}

function cargando(activo, texto = "Cargando…") {
  $("#cargando").classList.toggle("oculto", !activo);
  $("#texto-cargando").textContent = texto;
}

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function llenarSelect(elemento, valores, opciones = {}) {
  const { vacio = null, valorCampo = null, textoCampo = null } = opciones;
  elemento.innerHTML = "";
  if (vacio !== null) {
    elemento.appendChild(new Option(vacio, ""));
  }
  for (const v of valores) {
    if (valorCampo) {
      const opcion = new Option(textoCampo(v), v[valorCampo]);
      // Guardamos datos extra en el <option> (p.ej. gravedad sugerida)
      if (v.gravedad_default) opcion.dataset.gravedad = v.gravedad_default;
      elemento.appendChild(opcion);
    } else {
      elemento.appendChild(new Option(v, v));
    }
  }
}

// ---------------------------------------------------------------------------
// Acceso (token)
// ---------------------------------------------------------------------------
function mostrarAcceso(mostrar) {
  $("#acceso").classList.toggle("oculto", !mostrar);
  $$("main > section:not(#acceso)").forEach((s) => {
    if (mostrar) s.classList.add("oculto");
  });
  $("#nav").classList.toggle("oculto", mostrar);
  if (!mostrar) irA("dashboard");
}

$("#btn-entrar").addEventListener("click", async () => {
  const token = $("#campo-token").value.trim();
  if (!token) return avisar("Escribe la contraseña de acceso.", "danger");
  API.guardarToken(token);
  await iniciar();
});

$("#campo-token").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("#btn-entrar").click();
});

$("#btn-salir").addEventListener("click", () => {
  API.borrarToken();
  location.reload();
});

// ---------------------------------------------------------------------------
// Navegación entre secciones
// ---------------------------------------------------------------------------
function irA(seccion) {
  $$("main > section").forEach((s) => s.classList.add("oculto"));
  $(`#seccion-${seccion}`)?.classList.remove("oculto");
  $$(".nav-link").forEach((a) => a.classList.remove("activa"));
  $(`.nav-link[data-seccion="${seccion}"]`)?.classList.add("activa");

  // Cada sección recarga sus datos al entrar
  if (seccion === "dashboard") cargarDashboard();
  if (seccion === "incidencia") cargarServiciosEnSelect();
  if (seccion === "pendientes") cargarPendientes();
  if (seccion === "clientes") pintarClientes();
  if (seccion === "tipos") pintarTipos();
  if (seccion === "reportes") cargarOpcionesReporte();
}

$$(".nav-link").forEach((enlace) => {
  enlace.addEventListener("click", (e) => {
    e.preventDefault();
    irA(enlace.dataset.seccion);
  });
});

// ---------------------------------------------------------------------------
// Arranque: carga los catálogos y decide si pedir contraseña
// ---------------------------------------------------------------------------
async function iniciar() {
  cargando(true, "Conectando con el servidor… (puede tardar ~1 min si estaba dormido)");
  try {
    CATALOGOS = await API.get("/api/catalogos");
    CLIENTES = await API.get("/api/clientes");
    TIPOS = await API.get("/api/tipos");

    // Poblar los selectores fijos
    llenarSelect($("#sel-tipo-servicio"), CATALOGOS.tipos_servicio);
    llenarSelect($("#sel-resultado"), CATALOGOS.resultados);
    llenarSelect($("#sel-categoria"), CATALOGOS.categorias);
    llenarSelect($("#sel-estado"), CATALOGOS.estados);
    llenarSelect($("#sel-frecuencia"), CATALOGOS.frecuencias || []);
    if ($("#sel-frecuencia")) $("#sel-frecuencia").value = "Mensual";
    llenarSelect($("#sel-tipo-reporte"), CATALOGOS.tipos_reporte);

    const gravedadesTexto = CATALOGOS.gravedades.map(
      (g) => `${g} — ${CATALOGOS.descripcion_gravedad[g]}`);
    $("#sel-gravedad").innerHTML = "";
    $("#sel-gravedad-tipo").innerHTML = "";
    CATALOGOS.gravedades.forEach((g, i) => {
      $("#sel-gravedad").appendChild(new Option(gravedadesTexto[i], g));
      $("#sel-gravedad-tipo").appendChild(new Option(gravedadesTexto[i], g));
    });
    $("#sel-gravedad-tipo").value = "Amarillo";

    llenarSelect($("#sel-cliente-servicio"), CLIENTES, {
      valorCampo: "id",
      textoCampo: (c) => `${c.nombre} (${c.categoria} · ${c.estado})`,
    });
    llenarSelect($("#sel-tipo-incidencia"), TIPOS, {
      valorCampo: "id", textoCampo: (t) => t.nombre,
    });

    $("input[name=fecha]").value = hoy();
    $("input[name=fecha_resolucion]").value = hoy();

    mostrarAcceso(false);
  } catch (error) {
    // Si falla, probablemente no hay token válido o el backend no responde
    mostrarAcceso(true);
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const CLAVES_FILTRO = ["anio", "trimestre", "mes", "semana", "estado",
                       "categoria", "cliente", "frecuencia", "responsable",
                       "tipo", "gravedad"];
const ETIQUETAS_FILTRO = {
  anio: "Año", trimestre: "Trimestre", mes: "Mes", semana: "Semana",
  estado: "Estado", categoria: "Categoría", cliente: "Cliente",
  frecuencia: "Frecuencia", responsable: "Responsable",
  tipo: "Tipo de incidencia", gravedad: "Gravedad",
};
const CAMPO_OPCIONES = {
  anio: "anios", trimestre: "trimestres", mes: "meses", semana: "semanas",
  estado: "estados", categoria: "categorias", cliente: "clientes",
  frecuencia: "frecuencias", responsable: "responsables", tipo: "tipos",
  gravedad: "gravedades",
};
// Filtros Sí/No (no vienen de una lista de opciones del backend)
const FILTROS_SINO = {
  reporto_cliente: "Reporte del cliente",
  resuelta_a_tiempo: "Resuelta a tiempo",
  prioritario: "Solo prioritarios",
};

async function cargarDashboard() {
  cargando(true);
  try {
    const filtros = new FormData($("#form-filtros"));
    const query = new URLSearchParams();
    for (const [clave, valor] of filtros.entries()) {
      if (valor) query.append(clave, valor);
    }

    const datos = await API.get(`/api/dashboard?${query.toString()}`);

    construirFiltros(datos.opciones, Object.fromEntries(filtros));
    pintarKPIs(datos.kpis);
    pintarGraficas(datos.graficas);
    pintarDetalle(datos.detalle);

    if (datos.sin_datos) {
      avisar("Aún no hay servicios registrados. Comienza en «Registrar servicio».", "info");
    }
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
}

function construirFiltros(opciones, seleccion) {
  const contenedor = $("#contenedor-filtros");
  // Se conservan los dos campos de fecha (los primeros dos hijos)
  while (contenedor.children.length > 2) contenedor.lastChild.remove();

  for (const clave of CLAVES_FILTRO) {
    const valores = opciones[CAMPO_OPCIONES[clave]] || [];
    const columna = document.createElement("div");
    columna.className = "col-6 col-md-2";
    columna.innerHTML = `
      <label class="form-label small mb-0">${ETIQUETAS_FILTRO[clave]}</label>
      <select class="form-select form-select-sm" name="${clave}"></select>`;
    const select = columna.querySelector("select");
    llenarSelect(select, valores, { vacio: "Todos" });
    if (seleccion[clave]) select.value = seleccion[clave];
    contenedor.appendChild(columna);
  }

  // Filtros Sí/No (reporte del cliente, resuelta a tiempo, solo prioritarios)
  for (const [clave, etiqueta] of Object.entries(FILTROS_SINO)) {
    const columna = document.createElement("div");
    columna.className = "col-6 col-md-2";
    const opcionesSino = clave === "prioritario"
      ? `<option value="">Todos</option><option value="si">Sí</option>`
      : `<option value="">Todos</option><option value="si">Sí</option><option value="no">No</option>`;
    columna.innerHTML = `
      <label class="form-label small mb-0">${etiqueta}</label>
      <select class="form-select form-select-sm" name="${clave}">${opcionesSino}</select>`;
    if (seleccion[clave]) columna.querySelector("select").value = seleccion[clave];
    contenedor.appendChild(columna);
  }
}

function pintarKPIs(k) {
  const tarjetas = [
    [k.total_servicios, "Servicios registrados", "primary"],
    [k.total_incidencias, "Incidencias", "danger"],
    [k.pct_con_incidencia, "% con incidencia", "warning"],
    [k.pct_sin_incidencia, "% sin incidencias ✅", "success"],
    [`${k.retrasos} (${k.pct_retrasos})`, "Retrasos", "warning"],
    [`${k.vueltas} (${k.pct_vueltas})`, "Vueltas extra", "warning"],
    [k.quejas, "Reportes del cliente", "danger"],
    [k.pct_quejas, "% de quejas", "danger"],
    [k.pct_a_tiempo, "% resueltas a tiempo ⏱️", "success"],
    [k.abiertas, "Abiertas 🔓", "warning"],
    [k.cerradas, "Cerradas 🔒", "success"],
    [k.tiempo_promedio, "Resolución promedio", "info"],
    [k.inci_prioritarios, "Incid. prioritarios ⚠️", "danger"],
    [k.segundas_vueltas, "2ª vueltas no cobrables", "danger"],
  ];
  $("#tarjetas-kpi").innerHTML = tarjetas.map(([valor, etiqueta, color]) => `
    <div class="col-6 col-md-3 col-xl-2">
      <div class="card text-center shadow-sm h-100 border-${color}">
        <div class="card-body py-2">
          <div class="fs-4 fw-bold text-${color}">${valor}</div>
          <div class="small text-muted">${etiqueta}</div>
        </div>
      </div>
    </div>`).join("");
}

function pintarGraficas(graficas) {
  const contenedor = $("#graficas");
  contenedor.innerHTML = "";

  const orden = ["por_tipo", "por_gravedad", "por_cliente", "por_categoria",
                 "por_estado", "prioritarios", "frecuencia_vs_incidencias",
                 "tendencia_mensual", "tendencia_semanal"];
  for (const nombre of orden) {
    if (!graficas[nombre]) continue;
    const columna = document.createElement("div");
    columna.className = "col-md-6";
    columna.innerHTML = `<div class="card shadow-sm"><div id="g-${nombre}"></div></div>`;
    contenedor.appendChild(columna);
    Plotly.newPlot(`g-${nombre}`, graficas[nombre].data, graficas[nombre].layout,
                   { responsive: true, displayModeBar: false });
  }
}

function pintarDetalle(incidencias) {
  const colores = CATALOGOS.colores_gravedad || {};
  const si_no = (v) => (v === null || v === undefined ? "—" : v ? "Sí" : "No");

  $("#tabla-detalle").innerHTML = incidencias.map((i) => {
    const evidencias = (i.evidencias || []);
    const enlaces = evidencias.length
      ? evidencias.map((e, n) =>
          `<a href="${e.url}" target="_blank" title="${e.nombre}">📎${n + 1}</a>`).join(" ")
      : "—";
    const prioritario = i.es_prioritario ? " ⚠️" : "";
    return `<tr>
      <td>${i.fecha || ""}</td>
      <td>${i.cliente || ""}${prioritario}</td>
      <td>${i.estado || ""}</td>
      <td>${i.tipo_incidencia || ""}</td>
      <td><span class="badge" style="background:${colores[i.gravedad] || "#999"}">${i.gravedad}</span></td>
      <td>${i.vueltas_adicionales || 0}</td>
      <td>${i.minutos_retraso ? i.minutos_retraso + " min" : "—"}</td>
      <td>${si_no(i.reporto_cliente)}</td>
      <td>${si_no(i.resuelta)}</td>
      <td>${si_no(i.resuelta_a_tiempo)}</td>
      <td>${i.fecha_resolucion || "—"}</td>
      <td>${i.responsable || "—"}</td>
      <td>${enlaces}</td>
      <td class="small">${i.comentarios || ""}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="14" class="text-center text-muted py-3">
      Sin incidencias con los filtros seleccionados 🎉</td></tr>`;
}

$("#form-filtros").addEventListener("submit", (e) => {
  e.preventDefault();
  cargarDashboard();
});

$("#btn-limpiar").addEventListener("click", () => {
  $("#form-filtros").reset();
  cargarDashboard();
});

// ---------------------------------------------------------------------------
// Registrar servicio
// ---------------------------------------------------------------------------
$("#form-servicio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  cargando(true, "Guardando servicio…");
  try {
    const respuesta = await API.post("/api/servicios", {
      fecha: f.get("fecha"),
      cliente_id: f.get("cliente_id"),
      tipo_servicio: f.get("tipo_servicio"),
      hora_programada: f.get("hora_programada") || null,
      hora_real: f.get("hora_real") || null,
      realizado: f.get("realizado") === "si",
      resultado: f.get("resultado"),
      responsable: f.get("responsable"),
      observaciones: f.get("observaciones"),
    });
    avisar("Servicio guardado. Si hubo incidencias, regístralas ahora.");
    e.target.reset();
    $("input[name=fecha]").value = hoy();

    // Llevar a la pantalla de incidencia con este servicio preseleccionado
    await cargarServiciosEnSelect();
    $("#sel-servicio").value = respuesta.id;
    irA("incidencia");
    $("#sel-servicio").value = respuesta.id;
    actualizarBloquePrioritario();
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
});

// ---------------------------------------------------------------------------
// Registrar incidencia
// ---------------------------------------------------------------------------
async function cargarServiciosEnSelect() {
  try {
    SERVICIOS = await API.get("/api/servicios?limite=60");
    llenarSelect($("#sel-servicio"), SERVICIOS, {
      valorCampo: "id",
      textoCampo: (s) => `${s.fecha} | ${s.cliente} | ${s.tipo_servicio}`,
    });
    actualizarBloquePrioritario();
  } catch (error) {
    avisar(error.message, "danger");
  }
}

// Sugerir la gravedad por defecto del tipo elegido
$("#sel-tipo-incidencia").addEventListener("change", (e) => {
  const gravedad = e.target.selectedOptions[0]?.dataset.gravedad;
  if (gravedad) $("#sel-gravedad").value = gravedad;
});

// Mostrar el bloque de "cliente prioritario" solo si el servicio elegido
// corresponde a un cliente con cobro por recolección (Walmart/Bodega/Sam's).
function actualizarBloquePrioritario() {
  const id = $("#sel-servicio").value;
  const servicio = SERVICIOS.find((s) => s.id === id);
  const esPrioritario = !!(servicio && servicio.cobro_por_recoleccion);
  $("#bloque-prioritario").classList.toggle("oculto", !esPrioritario);
  if (!esPrioritario) {
    $("#chk-segunda-vuelta").checked = false;
    $("input[name=material_pendiente]").value = "";
  }
}
$("#sel-servicio").addEventListener("change", actualizarBloquePrioritario);

// Mostrar u ocultar el bloque de resolución
$$("input[name=resuelta]").forEach((radio) => {
  radio.addEventListener("change", () => {
    const resuelta = $("input[name=resuelta]:checked").value === "si";
    $("#bloque-resolucion").classList.toggle("oculto", !resuelta);
  });
});

$("#form-incidencia").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const resuelta = f.get("resuelta") === "si";

  cargando(true, "Guardando incidencia…");
  try {
    const respuesta = await API.post("/api/incidencias", {
      servicio_id: f.get("servicio_id"),
      tipo_incidencia_id: f.get("tipo_incidencia_id"),
      gravedad: f.get("gravedad"),
      descripcion: f.get("descripcion"),
      vueltas_adicionales: parseInt(f.get("vueltas_adicionales") || "0", 10),
      minutos_retraso: parseInt(f.get("minutos_retraso") || "0", 10),
      reporto_cliente: f.get("reporto_cliente") === "si",
      resuelta: resuelta,
      resuelta_a_tiempo: resuelta ? f.get("a_tiempo") === "si" : null,
      fecha_resolucion: resuelta ? f.get("fecha_resolucion") : null,
      accion_correctiva: f.get("accion_correctiva"),
      segunda_vuelta_no_cobrable: f.get("segunda_vuelta_no_cobrable") === "on",
      material_pendiente: f.get("material_pendiente"),
      comentarios: f.get("comentarios"),
    });

    // Subir las evidencias, si las hay
    const archivos = $("#campo-evidencias").files;
    if (archivos.length) {
      cargando(true, `Subiendo ${archivos.length} evidencia(s) a Firebase…`);
      const r = await API.subirArchivos(
        `/api/incidencias/${respuesta.id}/evidencias`, archivos);
      if (r.rechazadas?.length) {
        avisar(`Archivos rechazados (formato no permitido): ${r.rechazadas.join(", ")}`, "warning");
      }
      if (r.errores?.length) {
        avisar(`La incidencia se guardó, pero algunas evidencias no se pudieron subir: ${r.errores.join("; ")}`, "warning");
      }
      avisar(`Incidencia guardada con ${r.subidas.length} evidencia(s).`);
    } else {
      avisar("Incidencia guardada.");
    }

    e.target.reset();
    $("#bloque-resolucion").classList.add("oculto");
    $("#bloque-prioritario").classList.add("oculto");
    $("input[name=fecha_resolucion]").value = hoy();
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
});

// ---------------------------------------------------------------------------
// Pendientes
// ---------------------------------------------------------------------------
async function cargarPendientes() {
  cargando(true);
  try {
    const abiertas = await API.get("/api/incidencias?abiertas=1");
    const colores = CATALOGOS.colores_gravedad || {};

    if (!abiertas.length) {
      $("#lista-pendientes").innerHTML =
        `<div class="alert alert-success">🎉 No hay incidencias pendientes.</div>`;
      return;
    }

    $("#lista-pendientes").innerHTML = `
      <div class="card shadow-sm">
        <div class="table-responsive">
          <table class="table table-sm table-striped align-middle mb-0">
            <thead class="table-light">
              <tr><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Gravedad</th>
                  <th>Responsable</th><th>Comentarios</th><th></th></tr>
            </thead>
            <tbody>
              ${abiertas.map((i) => `
                <tr>
                  <td>${i.fecha}</td>
                  <td>${i.cliente}</td>
                  <td>${i.tipo_incidencia}</td>
                  <td><span class="badge" style="background:${colores[i.gravedad] || "#999"}">${i.gravedad}</span></td>
                  <td>${i.responsable || "—"}</td>
                  <td class="small">${i.comentarios || ""}</td>
                  <td><button class="btn btn-success btn-sm btn-resolver"
                        data-id="${i.id}">✅ Resolver</button></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    $$(".btn-resolver").forEach((boton) => {
      boton.addEventListener("click", () => resolver(boton.dataset.id));
    });
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
}

async function resolver(id) {
  const fecha = prompt("Fecha de resolución (AAAA-MM-DD):", hoy());
  if (!fecha) return;
  const aTiempo = confirm("¿Se resolvió a tiempo?\n\nAceptar = Sí | Cancelar = No");
  const comentario = prompt("Comentario de cierre (opcional):", "") || null;

  cargando(true, "Cerrando incidencia…");
  try {
    await API.post(`/api/incidencias/${id}/resolver`, {
      fecha_resolucion: fecha,
      resuelta_a_tiempo: aTiempo,
      comentario: comentario,
    });
    avisar("Incidencia marcada como resuelta.");
    cargarPendientes();
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
function pintarClientes() {
  $("#tabla-clientes").innerHTML = CLIENTES.map((c) => `
    <tr>
      <td>${c.nombre}</td>
      <td>${c.categoria}</td>
      <td>${c.estado}</td>
      <td>${c.frecuencia || "—"}</td>
      <td><span class="badge bg-${c.activo ? "success" : "secondary"}">${c.estatus}</span></td>
      <td>${c.cobro_por_recoleccion ? "⚠️ Sí" : "No"}</td>
    </tr>`).join("");
}

$("#form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  cargando(true, "Guardando cliente…");
  try {
    const r = await API.post("/api/clientes", {
      nombre: f.get("nombre"),
      categoria: f.get("categoria"),
      estado: f.get("estado"),
      frecuencia: f.get("frecuencia"),
      activo: f.get("activo") === "on",
      cobro_por_recoleccion: f.get("cobro_por_recoleccion") === "on",
    });
    avisar(r.mensaje);
    e.target.reset();
    CLIENTES = await API.get("/api/clientes");
    llenarSelect($("#sel-cliente-servicio"), CLIENTES, {
      valorCampo: "id",
      textoCampo: (c) => `${c.nombre} (${c.categoria} · ${c.estado})`,
    });
    pintarClientes();
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
});

// ---------------------------------------------------------------------------
// Tipos de incidencia
// ---------------------------------------------------------------------------
function pintarTipos() {
  const colores = CATALOGOS.colores_gravedad || {};
  $("#tabla-tipos").innerHTML = TIPOS.map((t) => `
    <tr>
      <td>${t.nombre}</td>
      <td class="small">${t.descripcion || ""}</td>
      <td><span class="badge" style="background:${colores[t.gravedad_default] || "#999"}">
        ${t.gravedad_default}</span></td>
    </tr>`).join("");
}

$("#form-tipo").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  cargando(true, "Guardando tipo…");
  try {
    const r = await API.post("/api/tipos", {
      nombre: f.get("nombre"),
      descripcion: f.get("descripcion"),
      gravedad_default: f.get("gravedad_default"),
    });
    avisar(r.mensaje);
    e.target.reset();
    TIPOS = await API.get("/api/tipos");
    llenarSelect($("#sel-tipo-incidencia"), TIPOS, {
      valorCampo: "id", textoCampo: (t) => t.nombre,
    });
    pintarTipos();
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
});

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------
async function cargarOpcionesReporte() {
  cargando(true);
  try {
    OPCIONES_REPORTE = await API.get("/api/reportes/opciones");
    actualizarValoresReporte();
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
}

function actualizarValoresReporte() {
  const tipo = $("#sel-tipo-reporte").value;
  const mapa = {
    "Semanal": ["semanas", "Semana"],
    "Mensual": ["meses", "Mes"],
    "Trimestral": ["trimestres", "Trimestre"],
    "Anual": ["anios", "Año"],
    "Por cliente": ["clientes", "Cliente"],
  };

  if (!mapa[tipo]) {
    // "Incidencias pendientes" no necesita periodo
    $("#bloque-valor-reporte").classList.add("oculto");
    return;
  }

  const [campo, etiqueta] = mapa[tipo];
  $("#bloque-valor-reporte").classList.remove("oculto");
  $("#etiqueta-valor").textContent = etiqueta;
  llenarSelect($("#sel-valor-reporte"), OPCIONES_REPORTE[campo] || []);
}

$("#sel-tipo-reporte").addEventListener("change", actualizarValoresReporte);

$("#form-reporte").addEventListener("submit", async (e) => {
  e.preventDefault();
  cargando(true, "Generando el reporte en el servidor…");
  try {
    await API.descargarReporte({
      tipo: $("#sel-tipo-reporte").value,
      valor: $("#sel-valor-reporte").value || "",
      evidencias: $("#chk-evidencias").checked ? "1" : "0",
    });
    avisar("Reporte descargado.");
  } catch (error) {
    avisar(error.message, "danger");
  } finally {
    cargando(false);
  }
});

// ---------------------------------------------------------------------------
// Arranque de la aplicación
// ---------------------------------------------------------------------------
if (API.obtenerToken()) {
  iniciar();                  // Ya hay token guardado: entrar directo
} else {
  mostrarAcceso(true);        // Primera vez: pedir contraseña
  cargando(false);
}
