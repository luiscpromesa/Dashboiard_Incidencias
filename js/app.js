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

   Nota sobre el rediseño: la lógica, las rutas del API y los cálculos son los
   mismos de siempre. Lo único que cambió son las funciones que GENERAN HTML
   (avisar, construirFiltros, pintarKPIs, pintarGraficas, pintarDetalle,
   pintarClientes, pintarTipos y cargarPendientes), que ahora usan los
   componentes visuales definidos en js/ui.js y css/componentes.css.
   `UI` se invoca siempre de forma opcional (UI?.…) para que app.js siga
   funcionando aunque ui.js no llegue a cargar.
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

// Icono que acompaña a cada tipo de aviso (no depende solo del color)
const ICONO_AVISO = {
  success: "check", danger: "incidencia", warning: "alerta", info: "info",
};

function avisar(mensaje, tipo = "success") {
  const contenedor = $("#avisos");
  const alerta = document.createElement("div");
  alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
  alerta.setAttribute("role", tipo === "danger" ? "alert" : "status");
  const icono = UI?.icono(ICONO_AVISO[tipo] || "info") || "";
  alerta.innerHTML = `
    <div class="aviso-fila">${icono}<div>${mensaje}</div></div>
    <button class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar aviso"></button>`;
  contenedor.appendChild(alerta);
  // Los avisos de éxito e informativos se van solos; los de error se quedan
  if (tipo === "success" || tipo === "info") setTimeout(() => alerta.remove(), 6000);
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
  // La pantalla de acceso ocupa todo el navegador; el armazón (menú lateral,
  // encabezado y contenido) se oculta completo mientras no haya sesión.
  $("#acceso").classList.toggle("oculto", !mostrar);
  $("#app-shell").classList.toggle("oculto", mostrar);
  $$("main > section").forEach((s) => {
    if (mostrar) s.classList.add("oculto");
  });
  $("#nav").classList.toggle("oculto", mostrar);
  if (mostrar) $("#campo-token").focus();
  else irA("dashboard");
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
  const destino = $(`#seccion-${seccion}`);
  destino?.classList.remove("oculto");
  $$(".nav-link").forEach((a) => {
    a.classList.remove("activa");
    a.removeAttribute("aria-current");
  });
  const enlace = $(`.nav-link[data-seccion="${seccion}"]`);
  enlace?.classList.add("activa");
  enlace?.setAttribute("aria-current", "page");

  // ui.js escucha este atributo para actualizar el encabezado superior
  // y decidir si el panel de filtros aplica en esta sección.
  document.body.dataset.seccion = seccion;
  window.scrollTo({ top: 0, behavior: "instant" });

  // Cada sección recarga sus datos al entrar
  if (seccion === "dashboard") cargarDashboard();
  if (seccion === "historial") cargarDashboard();
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

    // Presentación: leyenda de gravedades y vista previa del nivel elegido
    UI?.pintarLeyendaGravedad(CATALOGOS);
    UI?.conectarVistaGravedad(CATALOGOS);

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
  UI?.esqueletosDashboard();          // Placeholders mientras llegan los datos
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

    // Indicadores de la interfaz: periodo, filtros activos y hora de consulta
    UI?.pintarFiltrosActivos();
    UI?.actualizarPeriodo();
    UI?.mostrarResultados((datos.detalle || []).length);
    UI?.marcarActualizacion();

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
    columna.innerHTML = `
      <label class="form-label" for="f-${clave}">${ETIQUETAS_FILTRO[clave]}</label>
      <select class="form-select form-select-sm" name="${clave}" id="f-${clave}"></select>`;
    const select = columna.querySelector("select");
    llenarSelect(select, valores, { vacio: "Todos" });
    if (seleccion[clave]) select.value = seleccion[clave];
    contenedor.appendChild(columna);
  }

  // Filtros Sí/No (reporte del cliente, resuelta a tiempo, solo prioritarios)
  for (const [clave, etiqueta] of Object.entries(FILTROS_SINO)) {
    const columna = document.createElement("div");
    const opcionesSino = clave === "prioritario"
      ? `<option value="">Todos</option><option value="si">Sí</option>`
      : `<option value="">Todos</option><option value="si">Sí</option><option value="no">No</option>`;
    columna.innerHTML = `
      <label class="form-label" for="f-${clave}">${etiqueta}</label>
      <select class="form-select form-select-sm" name="${clave}" id="f-${clave}">${opcionesSino}</select>`;
    if (seleccion[clave]) columna.querySelector("select").value = seleccion[clave];
    contenedor.appendChild(columna);
  }
}

// Paleta de las tarjetas de indicador. El verde y el azul son corporativos;
// el rojo y el naranja se reservan para lo que exige atención operativa.
const TONOS_KPI = {
  verde:   ["var(--verde)",       "var(--verde-claro)"],
  azul:    ["var(--azul)",        "var(--azul-claro)"],
  rojo:    ["var(--grav-rojo)",   "var(--peligro-fondo)"],
  naranja: ["var(--grav-naranja)","var(--aviso-fondo)"],
};

/**
 * Chip de comparación con el periodo anterior.
 * El backend puede enviar `kpis.comparativo = { clave: { texto, direccion } }`.
 * Mientras no lo envíe, la tarjeta muestra su nota explicativa y no se
 * inventa ninguna cifra.
 */
function chipTendencia(kpis, clave) {
  const dato = kpis.comparativo?.[clave];
  if (!dato || !dato.texto) return "";
  const direccion = dato.direccion || "plana";
  const icono = { sube: "arriba", baja: "abajo" }[direccion] || "igual";
  return `<span class="kpi-tendencia ${direccion}"
    data-tip="Comparado con el periodo anterior" tabindex="0">
    ${UI?.icono(icono) || ""}${UI?.escapar(dato.texto) || dato.texto}</span>`;
}

function pintarKPIs(k) {
  // [clave, valor, nombre, icono, tono, nota breve, texto del tooltip]
  const tarjetas = [
    ["total_servicios", k.total_servicios, "Servicios registrados", "camion", "azul",
     "Base de cálculo de todos los porcentajes.",
     "Servicios de recolección registrados en el periodo filtrado, con y sin incidencias."],

    ["total_incidencias", k.total_incidencias, "Total de incidencias", "incidencia", "rojo",
     "Incidencias documentadas en el periodo.",
     "Suma de incidencias registradas sobre los servicios del periodo filtrado."],

    ["pct_sin_incidencia", k.pct_sin_incidencia, "Recolecciones sin incidencias", "check", "verde",
     "Servicios que salieron limpios.",
     "Porcentaje de servicios que se completaron sin ninguna incidencia asociada."],

    ["pct_con_incidencia", k.pct_con_incidencia, "Servicios con incidencia", "porcentaje", "naranja",
     "Complemento del indicador anterior.",
     "Porcentaje de servicios que tuvieron al menos una incidencia."],

    ["pct_a_tiempo", k.pct_a_tiempo, "Resueltas a tiempo", "reloj", "verde",
     "Sobre las incidencias ya cerradas.",
     "De las incidencias resueltas, cuántas se cerraron dentro del plazo esperado."],

    ["retrasos", `${k.retrasos} (${k.pct_retrasos})`, "Total de retrasos", "reloj", "naranja",
     "Servicios que llegaron tarde.",
     "Número de incidencias con tiempo de retraso registrado y su peso sobre el total."],

    ["vueltas", `${k.vueltas} (${k.pct_vueltas})`, "Vueltas adicionales", "repetir", "naranja",
     "Recolecciones extra que hubo que hacer.",
     "Vueltas adicionales generadas por incidencias y su peso sobre el total."],

    ["quejas", k.quejas, "Reportes del cliente", "megafono", "rojo",
     "Casos que el cliente escaló.",
     "Incidencias en las que el cliente presentó un reporte o queja. El seguimiento lo llevan RH y jefatura."],

    ["pct_quejas", k.pct_quejas, "% de quejas", "porcentaje", "rojo",
     "Proporción de casos escalados.",
     "Porcentaje de incidencias que derivaron en un reporte del cliente."],

    ["inci_prioritarios", k.inci_prioritarios, "Clientes prioritarios afectados", "alerta", "rojo",
     "Walmart, Bodega y Sam's.",
     "Incidencias registradas en clientes con cobro por recolección, donde el impacto comercial es mayor."],

    ["segundas_vueltas", k.segundas_vueltas, "2ª vueltas no cobrables", "repetir", "rojo",
     "Costo operativo que no se recupera.",
     "Segundas vueltas realizadas en clientes prioritarios que no se pueden facturar."],

    ["abiertas", k.abiertas, "Incidencias abiertas", "pendientes", "naranja",
     "Pendientes de cierre.",
     "Incidencias que todavía no se marcan como resueltas."],

    ["cerradas", k.cerradas, "Incidencias cerradas", "candado", "verde",
     "Casos ya resueltos.",
     "Incidencias marcadas como resueltas en el periodo filtrado."],

    ["tiempo_promedio", k.tiempo_promedio, "Resolución promedio", "reloj", "azul",
     "Tiempo medio hasta el cierre.",
     "Promedio de tiempo transcurrido entre el registro y la resolución de una incidencia."],
  ];

  $("#tarjetas-kpi").className = "rejilla-kpi animar-escalonado";
  $("#tarjetas-kpi").innerHTML = tarjetas.map(
    ([clave, valor, nombre, icono, tono, nota, ayuda]) => {
      const [color, fondo] = TONOS_KPI[tono] || TONOS_KPI.azul;
      return `
      <article class="kpi" style="--kpi-color:${color};--kpi-fondo:${fondo}"
               tabindex="0" data-tip="${UI?.escapar(ayuda) || ayuda}">
        <div class="kpi-encabezado">
          <span class="kpi-icono" aria-hidden="true">${UI?.icono(icono) || ""}</span>
          <span class="kpi-nombre">${nombre}</span>
        </div>
        <div class="kpi-valor">${valor ?? "—"}</div>
        ${chipTendencia(k, clave)}
        <p class="kpi-nota">${nota}</p>
      </article>`;
    }).join("");
}

// Título e icono de cada gráfica. Si el layout del backend ya trae título,
// ese se respeta dentro del lienzo; esto es solo la cabecera de la tarjeta.
const CABECERA_GRAFICA = {
  tendencia_mensual: ["Tendencia mensual", "dashboard"],
  tendencia_semanal: ["Tendencia por semana", "dashboard"],
  por_tipo: ["Incidencias por tipo", "tipos"],
  por_gravedad: ["Incidencias por nivel de gravedad", "alerta"],
  por_cliente: ["Incidencias por cliente", "clientes"],
  por_categoria: ["Comparación entre categorías de clientes", "panel"],
  por_estado: ["Incidencias por estado", "panel"],
  prioritarios: ["Clientes prioritarios con mayor afectación", "incidencia"],
  frecuencia_vs_incidencias: ["Frecuencia de recolección vs. incidencias", "repetir"],
};

function pintarGraficas(graficas) {
  const contenedor = $("#graficas");
  contenedor.innerHTML = "";

  // Primero la tendencia (lo que más se consulta), luego los desgloses
  const orden = ["tendencia_mensual", "tendencia_semanal",
                 "por_tipo", "por_gravedad", "por_cliente", "por_categoria",
                 "por_estado", "prioritarios", "frecuencia_vs_incidencias"];

  let dibujadas = 0;
  for (const nombre of orden) {
    if (!graficas[nombre]) continue;
    const [titulo, icono] = CABECERA_GRAFICA[nombre] || [nombre, "panel"];

    const tarjeta = document.createElement("section");
    tarjeta.className = "tarjeta-grafica";
    tarjeta.style.animationDelay = `${Math.min(dibujadas, 6) * 40}ms`;
    tarjeta.innerHTML = `
      <h3 class="cabecera">${UI?.icono(icono) || ""}${titulo}</h3>
      <div class="lienzo"><div id="g-${nombre}" role="img"
        aria-label="Gráfica: ${titulo}"></div></div>`;
    contenedor.appendChild(tarjeta);

    Plotly.newPlot(`g-${nombre}`,
                   graficas[nombre].data,
                   UI?.temaGrafica(graficas[nombre].layout) || graficas[nombre].layout,
                   UI?.CONFIG_GRAFICA || { responsive: true, displayModeBar: false });
    dibujadas++;
  }

  // Mensaje claro cuando no hay nada que graficar
  if (!dibujadas) {
    contenedor.innerHTML = `
      <div class="tarjeta">
        <div class="estado-vacio">
          ${UI?.icono("hoja") || ""}
          <strong>Sin datos para graficar</strong>
          <p>No hay incidencias que cumplan los filtros seleccionados.
             Prueba a ampliar el periodo o a limpiar los filtros.</p>
        </div>
      </div>`;
  }
}

function pintarDetalle(incidencias) {
  const colores = CATALOGOS.colores_gravedad || {};
  const descripciones = CATALOGOS.descripcion_gravedad || {};
  const esc = (v) => UI?.escapar(v) ?? String(v ?? "");
  // Etiqueta Sí/No con icono; nunca se comunica el estado solo con color
  const siNo = (v, opciones) => UI?.etiquetaSiNo(v, opciones)
    ?? (v === null || v === undefined ? "—" : v ? "Sí" : "No");

  $("#tabla-detalle").innerHTML = incidencias.map((i) => {
    const evidencias = i.evidencias || [];
    const enlaces = evidencias.length
      ? evidencias.map((e, n) => `
          <a class="enlace-evidencia" href="${esc(e.url)}" target="_blank" rel="noopener"
             title="Abrir ${esc(e.nombre)}" aria-label="Abrir evidencia ${n + 1}: ${esc(e.nombre)}">
            ${UI?.icono("archivo", "ico ico-sm") || ""}${n + 1}</a>`).join("")
      : '<span class="texto-2">—</span>';

    const prioritario = i.es_prioritario
      ? ` <span class="etiqueta etiqueta-peligro" data-tip="Cliente con cobro por recolección: el impacto comercial es mayor." tabindex="0">
            ${UI?.icono("alerta", "ico ico-sm") || ""}Prioritario</span>`
      : "";

    // Se marcan como críticas las de gravedad Rojo o de cliente prioritario
    const critica = i.gravedad === "Rojo" || i.es_prioritario;

    return `<tr class="${critica ? "critica" : ""}">
      <td data-etiqueta="Fecha" data-valor="${esc(i.fecha)}">${esc(i.fecha)}</td>
      <td data-etiqueta="Cliente" data-valor="${esc(i.cliente)}">${esc(i.cliente)}${prioritario}</td>
      <td data-etiqueta="Estado">${esc(i.estado)}</td>
      <td data-etiqueta="Tipo">${esc(i.tipo_incidencia)}</td>
      <td data-etiqueta="Gravedad" data-valor="${esc(i.gravedad)}">
        ${UI?.badgeGravedad(i.gravedad, colores, descripciones) ?? esc(i.gravedad)}</td>
      <td data-etiqueta="Vueltas" data-valor="${i.vueltas_adicionales || 0}">${i.vueltas_adicionales || 0}</td>
      <td data-etiqueta="Retraso" data-valor="${i.minutos_retraso || 0}">
        ${i.minutos_retraso ? i.minutos_retraso + " min" : '<span class="texto-2">—</span>'}</td>
      <td data-etiqueta="Reportó cliente">${siNo(i.reporto_cliente, { positivoEsBueno: false })}</td>
      <td data-etiqueta="Resuelta">${siNo(i.resuelta)}</td>
      <td data-etiqueta="A tiempo">${siNo(i.resuelta_a_tiempo)}</td>
      <td data-etiqueta="F. resolución" data-valor="${esc(i.fecha_resolucion)}">
        ${i.fecha_resolucion ? esc(i.fecha_resolucion) : '<span class="texto-2">—</span>'}</td>
      <td data-etiqueta="Responsable">${i.responsable ? esc(i.responsable) : '<span class="texto-2">—</span>'}</td>
      <td data-etiqueta="Evidencias">${enlaces}</td>
      <td data-etiqueta="Comentarios" class="celda-larga">${esc(i.comentarios)}</td>
    </tr>`;
  }).join("");

  // ui.js se encarga de la búsqueda, el ordenamiento, la paginación y del
  // mensaje cuando no hay resultados.
  UI?.tablaHistorial?.actualizar();
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
    const descripciones = CATALOGOS.descripcion_gravedad || {};
    const esc = (v) => UI?.escapar(v) ?? String(v ?? "");

    if (!abiertas.length) {
      $("#lista-pendientes").innerHTML = `
        <div class="tarjeta">
          <div class="estado-vacio">
            ${UI?.icono("check") || ""}
            <strong>No hay incidencias pendientes</strong>
            <p>Todas las incidencias registradas están cerradas. Buen trabajo.</p>
          </div>
        </div>`;
      return;
    }

    $("#lista-pendientes").innerHTML = `
      <div class="tarjeta">
        <div class="tarjeta-cabecera">
          ${UI?.icono("pendientes") || ""}
          Incidencias abiertas
          <span class="contador">${abiertas.length}</span>
        </div>
        <div class="tabla-envoltura">
          <table class="tabla-datos a-tarjetas">
            <caption class="solo-lectores">Incidencias abiertas pendientes de cierre</caption>
            <thead>
              <tr><th scope="col">Fecha</th><th scope="col">Cliente</th>
                  <th scope="col">Tipo</th><th scope="col">Gravedad</th>
                  <th scope="col">Responsable</th><th scope="col">Comentarios</th>
                  <th scope="col"><span class="solo-lectores">Acciones</span></th></tr>
            </thead>
            <tbody>
              ${abiertas.map((i) => `
                <tr class="${i.gravedad === "Rojo" ? "critica" : ""}">
                  <td data-etiqueta="Fecha">${esc(i.fecha)}</td>
                  <td data-etiqueta="Cliente">${esc(i.cliente)}</td>
                  <td data-etiqueta="Tipo">${esc(i.tipo_incidencia)}</td>
                  <td data-etiqueta="Gravedad">
                    ${UI?.badgeGravedad(i.gravedad, colores, descripciones) ?? esc(i.gravedad)}</td>
                  <td data-etiqueta="Responsable">${i.responsable ? esc(i.responsable) : '<span class="texto-2">—</span>'}</td>
                  <td data-etiqueta="Comentarios" class="celda-larga">${esc(i.comentarios)}</td>
                  <td data-etiqueta="Acciones">
                    <button class="btn btn-primary btn-sm btn-resolver" type="button"
                            data-id="${esc(i.id)}"
                            aria-label="Marcar como resuelta la incidencia de ${esc(i.cliente)} del ${esc(i.fecha)}">
                      ${UI?.icono("check") || ""}Resolver
                    </button></td>
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
  const esc = (v) => UI?.escapar(v) ?? String(v ?? "");

  $("#tabla-clientes").innerHTML = CLIENTES.map((c) => `
    <tr>
      <td data-etiqueta="Cliente"><strong>${esc(c.nombre)}</strong></td>
      <td data-etiqueta="Categoría">${esc(c.categoria)}</td>
      <td data-etiqueta="Estado">${esc(c.estado)}</td>
      <td data-etiqueta="Frecuencia">${c.frecuencia ? esc(c.frecuencia) : '<span class="texto-2">—</span>'}</td>
      <td data-etiqueta="Estatus">
        <span class="etiqueta ${c.activo ? "etiqueta-exito" : "etiqueta-neutra"}">
          ${UI?.icono(c.activo ? "check" : "x", "ico ico-sm") || ""}${esc(c.estatus)}</span></td>
      <td data-etiqueta="Cobro por recolección">
        ${c.cobro_por_recoleccion
          ? `<span class="etiqueta etiqueta-aviso"
                   data-tip="Cliente prioritario: las incidencias aquí tienen mayor impacto comercial." tabindex="0">
               ${UI?.icono("alerta", "ico ico-sm") || ""}Sí</span>`
          : '<span class="etiqueta etiqueta-neutra">No</span>'}</td>
    </tr>`).join("");

  // ui.js activa la búsqueda, el ordenamiento y el conteo de esta tabla
  UI?.tablaClientes?.actualizar();
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
  const descripciones = CATALOGOS.descripcion_gravedad || {};
  const esc = (v) => UI?.escapar(v) ?? String(v ?? "");

  $("#tabla-tipos").innerHTML = TIPOS.map((t) => `
    <tr>
      <td data-etiqueta="Tipo"><strong>${esc(t.nombre)}</strong></td>
      <td data-etiqueta="Descripción" class="celda-larga">${esc(t.descripcion)}</td>
      <td data-etiqueta="Gravedad por defecto">
        ${UI?.badgeGravedad(t.gravedad_default, colores, descripciones) ?? esc(t.gravedad_default)}</td>
    </tr>`).join("") || `
    <tr><td colspan="3">
      <div class="estado-vacio">
        ${UI?.icono("tipos") || ""}
        <strong>Sin tipos registrados</strong>
        <p>Agrega el primer tipo de incidencia con el formulario de abajo.</p>
      </div></td></tr>`;

  // La leyenda de gravedad de esta pantalla se refresca con el catálogo actual
  UI?.pintarLeyendaGravedad(CATALOGOS);
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
