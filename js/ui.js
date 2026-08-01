/* ===========================================================================
   ui.js — Comportamiento de la interfaz
   ===========================================================================
   Este archivo NO habla con el backend ni calcula indicadores: solo se ocupa
   de cómo se ve y cómo se navega la aplicación.

   Se carga ANTES que app.js y publica el objeto global `UI`, que app.js usa
   de forma opcional (siempre con `UI?.…`, para que app.js siga funcionando
   aunque este archivo no cargue).

   Contenido:
     1.  Utilidades y catálogo de secciones
     2.  Menú lateral (plegar, móvil, navegación)
     3.  Encabezado superior (título, periodo, última actualización, sesión)
     4.  Panel de filtros (plegado, chips de filtros activos)
     5.  Tablas (búsqueda, ordenamiento, paginación)
     6.  Formularios (validación, cambios sin guardar, autocompletado)
     7.  Evidencias (arrastrar y soltar + vista previa)
     8.  Gravedad (badges y leyenda)
     9.  Gráficas (tema visual de Plotly)
     10. Esqueletos de carga
=========================================================================== */

/* Se publica en `window` a propósito: app.js lo lee con `window.UI || null`,
   de modo que si este archivo fallara al cargar, app.js no se rompe. */
window.UI = (() => {
  "use strict";

  const sel  = (s, raiz = document) => raiz.querySelector(s);
  const sels = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

  /* =======================================================================
     1. Catálogo de secciones
     Título y descripción que muestra el encabezado superior. Las claves son
     las mismas que usa data-seccion / irA() en app.js.
  ======================================================================= */
  const SECCIONES = {
    inicio:     ["Inicio", "Bienvenida y accesos rápidos del sistema."],
    dashboard:  ["Dashboard", "Panorama general de las incidencias logísticas."],
    servicio:   ["Registrar servicio", "Alta de recolecciones, con o sin incidencias."],
    incidencia: ["Registrar incidencia", "Documenta qué ocurrió, su impacto y la evidencia."],
    pendientes: ["Pendientes", "Incidencias abiertas en espera de cierre."],
    historial:  ["Historial de incidencias", "Detalle completo con los filtros aplicados."],
    clientes:   ["Clientes", "Catálogo de clientes y condiciones de recolección."],
    tipos:      ["Tipos de incidencia", "Catálogo de tipos, niveles de gravedad y datos de la sesión."],
    reportes:   ["Reportes", "Exportación del concentrado en Excel."],
  };

  // Secciones que trabajan con el panel de filtros del dashboard
  const SECCIONES_CON_FILTROS = ["dashboard", "historial"];

  /* Escapa texto antes de meterlo en HTML. */
  function escapar(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* Devuelve un <svg> del sprite de iconos. */
  function icono(nombre, clase = "ico") {
    return `<svg class="${clase}" aria-hidden="true"><use href="#i-${nombre}"></use></svg>`;
  }

  /* =======================================================================
     2. Menú lateral
  ======================================================================= */
  const esMovil = () => window.matchMedia("(max-width: 991.98px)").matches;

  /* Preferencias de la interfaz. Se accede a localStorage con red de
     seguridad: al abrir el archivo directamente desde el disco (file://) o
     con las cookies bloqueadas, leer o escribir ahí lanza SecurityError y
     tumbaría toda la capa visual. */
  const preferencia = {
    leer(clave) {
      try { return localStorage.getItem(clave); } catch (_) { return null; }
    },
    guardar(clave, valor) {
      try { localStorage.setItem(clave, valor); } catch (_) { /* sin persistencia */ }
    },
  };

  function alternarMenu() {
    const cuerpo = document.body;
    if (esMovil()) {
      cuerpo.classList.toggle("lateral-abierto");
      sel("#fondo-lateral").hidden = !cuerpo.classList.contains("lateral-abierto");
    } else {
      cuerpo.classList.toggle("lateral-contraido");
      // Se recuerda la preferencia entre visitas
      preferencia.guardar("ui_lateral_contraido",
        cuerpo.classList.contains("lateral-contraido") ? "1" : "0");
    }
    sel("#btn-menu")?.setAttribute("aria-expanded",
      String(!cuerpo.classList.contains("lateral-contraido")));
    // Plotly necesita recalcular el ancho de las gráficas
    setTimeout(redimensionarGraficas, 280);
  }

  function cerrarMenuMovil() {
    document.body.classList.remove("lateral-abierto");
    const fondo = sel("#fondo-lateral");
    if (fondo) fondo.hidden = true;
  }

  function iniciarMenu() {
    if (preferencia.leer("ui_lateral_contraido") === "1" && !esMovil()) {
      document.body.classList.add("lateral-contraido");
    }
    sel("#btn-menu")?.addEventListener("click", alternarMenu);
    sel("#fondo-lateral")?.addEventListener("click", cerrarMenuMovil);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        cerrarMenuMovil();
        cerrarMenuUsuario();
      }
    });

    // Al elegir una sección en móvil, el menú se cierra solo
    sel("#nav")?.addEventListener("click", (e) => {
      if (e.target.closest(".nav-link") && esMovil()) cerrarMenuMovil();
    });

    // Botones de la interfaz que llevan a una sección: reutilizan el enlace
    // del menú para no duplicar la lógica de navegación de app.js.
    document.addEventListener("click", (e) => {
      const disparador = e.target.closest("[data-ir]");
      if (!disparador) return;
      e.preventDefault();
      sel(`.nav-link[data-seccion="${disparador.dataset.ir}"]`)?.click();
    });
  }

  /* =======================================================================
     3. Encabezado superior
  ======================================================================= */
  function actualizarEncabezado(seccion) {
    const [titulo, descripcion] = SECCIONES[seccion] || SECCIONES.dashboard;
    const elTitulo = sel("#titulo-seccion");
    const elDesc = sel("#desc-seccion");
    if (elTitulo) elTitulo.textContent = titulo;
    if (elDesc) elDesc.textContent = descripcion;

    // El panel de filtros solo aparece donde tiene sentido
    sel("#panel-filtros")?.classList.toggle(
      "oculto", !SECCIONES_CON_FILTROS.includes(seccion));

    document.title = `${titulo} · Incidencias Logísticas · Grupo PROMESA`;

    // Al volver al dashboard, las gráficas recalculan su ancho: Plotly no
    // puede medir un contenedor que estaba oculto.
    if (seccion === "dashboard") setTimeout(redimensionarGraficas, 60);
  }

  /** Marca el momento de la última consulta de datos. */
  function marcarActualizacion() {
    const el = sel("#texto-actualizado");
    if (!el) return;
    const ahora = new Date();
    el.textContent = "Actualizado " + ahora.toLocaleTimeString("es-MX", {
      hour: "2-digit", minute: "2-digit",
    });
    sel("#pildora-actualizado")?.setAttribute(
      "data-tip", `Última consulta: ${ahora.toLocaleString("es-MX")}`);
  }

  /** Muestra el periodo considerado, según los filtros de fecha. */
  function actualizarPeriodo() {
    const el = sel("#texto-periodo");
    if (!el) return;
    const desde = sel('#form-filtros [name="desde"]')?.value;
    const hasta = sel('#form-filtros [name="hasta"]')?.value;
    if (desde && hasta)      el.textContent = `${desde} → ${hasta}`;
    else if (desde)          el.textContent = `Desde ${desde}`;
    else if (hasta)          el.textContent = `Hasta ${hasta}`;
    else                     el.textContent = "Todo el historial";
  }

  function cerrarMenuUsuario() {
    sel("#panel-usuario")?.classList.add("oculto");
    sel("#btn-usuario")?.setAttribute("aria-expanded", "false");
  }

  function iniciarEncabezado() {
    const boton = sel("#btn-usuario");
    const panel = sel("#panel-usuario");
    boton?.addEventListener("click", (e) => {
      e.stopPropagation();
      const abierto = panel.classList.toggle("oculto");
      boton.setAttribute("aria-expanded", String(!abierto));
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".menu-usuario")) cerrarMenuUsuario();
    });

    // «Cerrar sesión» del menú lateral y de Configuración reutilizan el botón
    // real (#btn-salir), que es el que app.js tiene enlazado.
    const salir = () => {
      if (confirm("¿Cerrar la sesión en este navegador?\n\n" +
                  "Tendrás que volver a escribir la contraseña de acceso.")) {
        sel("#btn-salir")?.click();
      }
    };
    sel("#btn-salir-lateral")?.addEventListener("click", salir);
    sel("#btn-salir-config")?.addEventListener("click", salir);

    // Dato informativo del servidor configurado
    const servidor = (typeof CONFIG !== "undefined" && CONFIG.API_URL) || "—";
    const dato = sel("#dato-servidor");
    const datoConfig = sel("#dato-servidor-config");
    if (dato) dato.textContent = servidor;
    if (datoConfig) datoConfig.textContent = servidor;
  }

  /* =======================================================================
     4. Panel de filtros
  ======================================================================= */
  // Nombres legibles de cada filtro, para los chips de "filtros activos"
  const NOMBRE_FILTRO = {
    desde: "Desde", hasta: "Hasta", anio: "Año", trimestre: "Trimestre",
    mes: "Mes", semana: "Semana", estado: "Estado", categoria: "Categoría",
    cliente: "Cliente", frecuencia: "Frecuencia", responsable: "Responsable",
    tipo: "Tipo", gravedad: "Gravedad", reporto_cliente: "Reporte del cliente",
    resuelta_a_tiempo: "Resuelta a tiempo", prioritario: "Solo prioritarios",
  };

  function iniciarFiltros() {
    const panel = sel("#panel-filtros");
    const plegar = sel("#btn-plegar-filtros");
    plegar?.addEventListener("click", () => {
      const abierto = panel.classList.toggle("abierto");
      plegar.setAttribute("aria-expanded", String(abierto));
      setTimeout(redimensionarGraficas, 280);
    });

    // En pantallas chicas el panel arranca plegado para no comerse el espacio
    if (window.matchMedia("(max-width: 767.98px)").matches) {
      panel?.classList.remove("abierto");
      plegar?.setAttribute("aria-expanded", "false");
    }

    // Cualquier cambio en los filtros refresca los chips (sin consultar aún)
    sel("#form-filtros")?.addEventListener("change", () => {
      pintarFiltrosActivos();
      actualizarPeriodo();
    });

    // Quitar un filtro desde su chip: se limpia y se vuelve a consultar
    sel("#filtros-activos")?.addEventListener("click", (e) => {
      const quitar = e.target.closest("button[data-quitar]");
      if (!quitar) return;
      const campo = sel(`#form-filtros [name="${quitar.dataset.quitar}"]`);
      if (campo) campo.value = "";
      pintarFiltrosActivos();
      actualizarPeriodo();
      sel("#form-filtros")?.requestSubmit();
    });
  }

  /** Dibuja los chips de los filtros con valor y el contador de la cabecera. */
  function pintarFiltrosActivos() {
    const contenedor = sel("#filtros-activos");
    const formulario = sel("#form-filtros");
    if (!contenedor || !formulario) return;

    const activos = [];
    for (const [clave, valor] of new FormData(formulario).entries()) {
      if (valor) activos.push([clave, valor]);
    }

    contenedor.innerHTML = activos.map(([clave, valor]) => `
      <span class="chip-filtro">
        <span class="clave">${escapar(NOMBRE_FILTRO[clave] || clave)}:</span>
        ${escapar(valor)}
        <button type="button" data-quitar="${escapar(clave)}"
                aria-label="Quitar el filtro ${escapar(NOMBRE_FILTRO[clave] || clave)}">
          ${icono("x", "ico ico-sm")}
        </button>
      </span>`).join("");

    const contador = sel("#contador-filtros");
    if (contador) {
      contador.textContent = String(activos.length);
      contador.classList.toggle("oculto", activos.length === 0);
    }
  }

  /** Muestra cuántos resultados devolvió la consulta al servidor. */
  function mostrarResultados(cantidad) {
    const el = sel("#texto-resultados");
    if (!el) return;
    el.textContent = cantidad === 1
      ? "1 incidencia encontrada"
      : `${cantidad} incidencias encontradas`;
  }

  /* =======================================================================
     5. Tablas: búsqueda, ordenamiento y paginación (todo en el navegador;
        no se vuelve a consultar al servidor)
  ======================================================================= */
  function crearTabla({ tabla, cuerpo, buscador, paginacion, selectorFilas,
                        conteo, sustantivo = ["registro", "registros"] }) {
    const elTabla = sel(tabla);
    const elCuerpo = sel(cuerpo);
    const elBuscador = buscador ? sel(buscador) : null;
    const elPaginacion = paginacion ? sel(paginacion) : null;
    const elConteo = conteo ? sel(conteo) : null;
    if (!elTabla || !elCuerpo) return null;

    let filas = [];            // todas las <tr> que pintó app.js
    let filtradas = [];
    let pagina = 1;
    let porPagina = elPaginacion ? 25 : Infinity;
    let orden = { indice: null, dir: null };

    const textoFila = (fila) => fila.textContent.toLowerCase();

    const valorCelda = (fila, indice, tipo) => {
      const celda = fila.children[indice];
      if (!celda) return "";
      const crudo = celda.dataset.valor ?? celda.textContent.trim();
      if (tipo === "numero") {
        const n = parseFloat(String(crudo).replace(/[^\d.-]/g, ""));
        return isNaN(n) ? -Infinity : n;
      }
      return String(crudo).toLowerCase();
    };

    function aplicar() {
      const consulta = (elBuscador?.value || "").trim().toLowerCase();
      filtradas = consulta
        ? filas.filter((f) => textoFila(f).includes(consulta))
        : filas.slice();

      if (orden.indice !== null) {
        const th = elTabla.tHead?.rows[0]?.cells[orden.indice];
        const tipo = th?.dataset.orden || "texto";
        const signo = orden.dir === "asc" ? 1 : -1;
        filtradas.sort((a, b) => {
          const va = valorCelda(a, orden.indice, tipo);
          const vb = valorCelda(b, orden.indice, tipo);
          if (va < vb) return -signo;
          if (va > vb) return signo;
          return 0;
        });
      }

      const total = filtradas.length;
      const paginas = Math.max(1, Math.ceil(total / porPagina));
      if (pagina > paginas) pagina = paginas;

      const inicio = porPagina === Infinity ? 0 : (pagina - 1) * porPagina;
      const visibles = porPagina === Infinity
        ? filtradas
        : filtradas.slice(inicio, inicio + porPagina);

      elCuerpo.replaceChildren(...visibles);

      // Sin resultados: mensaje claro, no una tabla vacía
      if (!total) {
        const columnas = elTabla.tHead?.rows[0]?.cells.length || 1;
        const fila = document.createElement("tr");
        fila.innerHTML = `<td colspan="${columnas}">
          <div class="estado-vacio">
            ${icono("hoja", "ico")}
            <strong>${filas.length ? "Sin coincidencias" : "Sin registros"}</strong>
            <p>${filas.length
              ? "Ningún registro coincide con la búsqueda. Prueba con otro término."
              : "No hay información con los filtros seleccionados."}</p>
          </div></td>`;
        elCuerpo.appendChild(fila);
      }

      if (elConteo) {
        elConteo.textContent =
          `${total} ${total === 1 ? sustantivo[0] : sustantivo[1]}`;
      }
      pintarPaginacion(total, paginas, inicio, visibles.length);
    }

    function pintarPaginacion(total, paginas, inicio, cuantas) {
      const cajon = elPaginacion;
      if (!cajon) return;
      if (!total) { cajon.innerHTML = ""; return; }

      const desde = inicio + 1;
      const hasta = inicio + cuantas;

      // Ventana de páginas alrededor de la actual
      const numeros = [];
      const primera = Math.max(1, pagina - 2);
      const ultima = Math.min(paginas, primera + 4);
      for (let p = Math.max(1, ultima - 4); p <= ultima; p++) numeros.push(p);

      cajon.innerHTML = `
        <span>Mostrando <strong>${desde}–${hasta}</strong> de <strong>${total}</strong></span>
        <nav class="paginas" aria-label="Paginación de la tabla">
          <button type="button" data-pagina="${pagina - 1}" ${pagina === 1 ? "disabled" : ""}
                  aria-label="Página anterior">‹</button>
          ${numeros.map((p) => `
            <button type="button" data-pagina="${p}"
              ${p === pagina ? 'aria-current="page"' : ""}>${p}</button>`).join("")}
          <button type="button" data-pagina="${pagina + 1}" ${pagina === paginas ? "disabled" : ""}
                  aria-label="Página siguiente">›</button>
        </nav>`;
    }

    // --- Eventos ---------------------------------------------------------
    elBuscador?.addEventListener("input", () => { pagina = 1; aplicar(); });

    if (selectorFilas) {
      sel(selectorFilas)?.addEventListener("change", (e) => {
        porPagina = parseInt(e.target.value, 10) || 25;
        pagina = 1;
        aplicar();
      });
    }

    elTabla.tHead?.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-orden]");
      if (!th) return;
      const indice = Array.from(th.parentNode.children).indexOf(th);
      if (orden.indice === indice) {
        orden.dir = orden.dir === "asc" ? "desc" : "asc";
      } else {
        orden = { indice, dir: "asc" };
      }
      sels("th[data-orden]", elTabla).forEach((otro) => {
        delete otro.dataset.dir;
        otro.setAttribute("aria-sort", "none");
      });
      th.dataset.dir = orden.dir;
      // aria-sort mantiene informados a los lectores de pantalla sin
      // romper el rol de encabezado de columna de la celda.
      th.setAttribute("aria-sort", orden.dir === "asc" ? "ascending" : "descending");
      aplicar();
    });

    // El encabezado también se ordena con teclado
    sels("th[data-orden]", elTabla).forEach((th) => {
      th.tabIndex = 0;
      th.setAttribute("aria-sort", "none");
      th.title = "Ordenar por esta columna";
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); th.click(); }
      });
    });

    elPaginacion?.addEventListener("click", (e) => {
      const salto = e.target.closest("button[data-pagina]");
      if (!salto || salto.disabled) return;
      pagina = parseInt(salto.dataset.pagina, 10);
      aplicar();
      elTabla.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return {
      /** app.js llama a esto después de repintar el <tbody>. */
      actualizar() {
        filas = Array.from(elCuerpo.children).filter((f) => !f.dataset.vacia);
        pagina = 1;
        aplicar();
      },
    };
  }

  /* =======================================================================
     6. Formularios
  ======================================================================= */
  const sucios = new Set();

  function marcarLimpio(formulario) {
    sucios.delete(formulario);
    sel("[data-aviso-cambios]", formulario)?.classList.add("oculto");
  }

  function iniciarFormularios() {
    sels("form[data-guardar-cambios]").forEach((formulario) => {
      formulario.addEventListener("input", () => {
        sucios.add(formulario);
        sel("[data-aviso-cambios]", formulario)?.classList.remove("oculto");
      });
      formulario.addEventListener("reset", () => marcarLimpio(formulario));

      /* Validación con mensaje junto al campo, en lugar del globo del
         navegador. Este listener se registra ANTES que el de app.js
         (ui.js se carga primero), así que si algo falta se detiene la
         propagación y app.js nunca llega a enviar la petición. */
      formulario.addEventListener("submit", (e) => {
        let valido = true;
        sels("[required]", formulario).forEach((campo) => {
          const invalido = !String(campo.value).trim();
          campo.classList.toggle("invalido", invalido);
          campo.setAttribute("aria-invalid", String(invalido));
          const contenedor = campo.parentElement;
          let mensaje = contenedor.querySelector(".mensaje-error");
          if (invalido) {
            if (!mensaje) {
              mensaje = document.createElement("p");
              mensaje.className = "mensaje-error";
              mensaje.innerHTML =
                `${icono("alerta", "ico ico-sm")} Este campo es obligatorio.`;
              contenedor.appendChild(mensaje);
            }
            valido = false;
          } else if (mensaje) {
            mensaje.remove();
          }
        });

        if (!valido) {
          e.preventDefault();
          e.stopImmediatePropagation();
          sel(".invalido", formulario)?.focus();
          return;
        }
        marcarLimpio(formulario);
      });
    });

    // Botones «Limpiar» de cada formulario
    document.addEventListener("click", (e) => {
      const boton = e.target.closest("[data-limpiar-form]");
      if (!boton) return;
      const formulario = boton.closest("form");
      if (!formulario) return;
      if (sucios.has(formulario) &&
          !confirm("Se borrará lo que has escrito en este formulario. ¿Continuar?")) return;
      formulario.reset();
      sels(".invalido", formulario).forEach((c) => c.classList.remove("invalido"));
      sels(".mensaje-error", formulario).forEach((m) => m.remove());
      formulario.dispatchEvent(new Event("limpiado"));
    });

    // Advertencia al cerrar o recargar con cambios sin guardar
    window.addEventListener("beforeunload", (e) => {
      if (sucios.size) { e.preventDefault(); e.returnValue = ""; }
    });

    // Advertencia al cambiar de sección con cambios sin guardar
    sel("#nav")?.addEventListener("click", (e) => {
      const enlace = e.target.closest(".nav-link");
      if (!enlace || !sucios.size) return;
      const abierto = sels("form[data-guardar-cambios]")
        .find((f) => sucios.has(f) && !f.closest("section")?.classList.contains("oculto"));
      if (!abierto) return;
      if (!confirm("Hay cambios sin guardar en este formulario.\n\n" +
                   "Si sales ahora se perderán. ¿Salir de todos modos?")) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else {
        marcarLimpio(abierto);
      }
    }, true);
  }

  /**
   * Autocompletado sencillo: un cuadro de texto filtra las <option> de un
   * <select> existente. El <select> sigue siendo el campo real del formulario,
   * así que app.js no cambia en nada.
   */
  function conectarBuscadorDeSelect(idBuscador, idSelect) {
    const buscador = sel(idBuscador);
    const selector = sel(idSelect);
    if (!buscador || !selector) return;

    let todas = [];
    const recordar = () => { todas = Array.from(selector.options).map((o) => o.cloneNode(true)); };

    buscador.addEventListener("input", () => {
      if (!todas.length) recordar();
      const consulta = buscador.value.trim().toLowerCase();
      const elegido = selector.value;
      const coincidencias = todas.filter((o) => o.text.toLowerCase().includes(consulta));
      selector.replaceChildren(...(coincidencias.length ? coincidencias : todas).map((o) => o.cloneNode(true)));
      // Se conserva la selección previa si sigue estando disponible
      if (Array.from(selector.options).some((o) => o.value === elegido)) {
        selector.value = elegido;
      }
      selector.dispatchEvent(new Event("change"));
    });

    // Cuando app.js vuelve a llenar el <select>, se rehace la copia
    new MutationObserver(() => { if (!buscador.value) recordar(); })
      .observe(selector, { childList: true });
    recordar();
  }

  /**
   * Campos de hora. El <input type="time"> siempre devuelve "HH:MM" en 24 h,
   * pero algunos navegadores lo DIBUJAN como 08:30 a.m. según el idioma del
   * sistema. Para que no haya dudas, debajo del campo se muestra el valor
   * normalizado a 24 horas. No se toca ni el valor ni el nombre del campo.
   */
  function iniciarCamposHora() {
    sels(".lectura-hora[data-para]").forEach((lectura) => {
      const campo = document.getElementById(lectura.dataset.para);
      if (!campo) return;
      const textoOriginal = lectura.innerHTML;

      const refrescar = () => {
        const valor = campo.value;                 // siempre "HH:MM" o ""
        if (!valor) {
          lectura.innerHTML = textoOriginal;
          lectura.classList.remove("con-valor");
          return;
        }
        lectura.innerHTML =
          `${icono("reloj", "ico ico-sm")} <span class="valor-24h">${escapar(valor)}</span> h`;
        lectura.classList.add("con-valor");
      };

      campo.addEventListener("input", refrescar);
      campo.addEventListener("change", refrescar);
      campo.closest("form")?.addEventListener("reset", () => setTimeout(refrescar, 0));
      refrescar();
    });
  }

  /* =======================================================================
     7. Evidencias: arrastrar, soltar y vista previa
  ======================================================================= */
  function iniciarEvidencias() {
    const zona = sel("#zona-evidencias");
    const campo = sel("#campo-evidencias");
    const previa = sel("#vista-evidencias");
    if (!zona || !campo || !previa) return;

    const pintarPrevia = () => {
      previa.innerHTML = "";
      Array.from(campo.files).forEach((archivo) => {
        const figura = document.createElement("figure");
        const esImagen = archivo.type.startsWith("image/");
        figura.innerHTML = esImagen
          ? `<img alt="Vista previa de ${escapar(archivo.name)}">`
          : `<div class="sin-imagen">${icono("archivo", "ico")}</div>`;
        figura.innerHTML += `<figcaption title="${escapar(archivo.name)}">${escapar(archivo.name)}</figcaption>`;
        if (esImagen) {
          const url = URL.createObjectURL(archivo);
          const img = figura.querySelector("img");
          img.src = url;
          img.onload = () => URL.revokeObjectURL(url);
        }
        previa.appendChild(figura);
      });
    };

    campo.addEventListener("change", pintarPrevia);

    ["dragenter", "dragover"].forEach((evento) =>
      zona.addEventListener(evento, (e) => {
        e.preventDefault();
        zona.classList.add("encima");
      }));

    ["dragleave", "drop"].forEach((evento) =>
      zona.addEventListener(evento, (e) => {
        e.preventDefault();
        zona.classList.remove("encima");
      }));

    zona.addEventListener("drop", (e) => {
      const soltados = e.dataTransfer?.files;
      if (!soltados?.length) return;
      // Se suman a los que ya había seleccionados
      const paquete = new DataTransfer();
      Array.from(campo.files).forEach((f) => paquete.items.add(f));
      Array.from(soltados).forEach((f) => paquete.items.add(f));
      campo.files = paquete.files;
      pintarPrevia();
    });

    // Al limpiar el formulario también se limpia la vista previa
    sel("#form-incidencia")?.addEventListener("reset", () => {
      setTimeout(() => { previa.innerHTML = ""; }, 0);
    });
  }

  /* =======================================================================
     8. Gravedad: badges y leyenda
  ======================================================================= */
  // Respaldo si el backend no manda color para algún nivel
  const COLOR_GRAVEDAD = {
    Rojo: "#D92D20", Naranja: "#E8730C", Amarillo: "#EAB308", Verde: "#10A34A",
  };
  const ICONO_GRAVEDAD = {
    Rojo: "incidencia", Naranja: "alerta", Amarillo: "info", Verde: "check",
  };

  /**
   * Badge de gravedad: color + icono + texto + globo de ayuda.
   * Nunca se comunica la gravedad solo con el color.
   */
  function badgeGravedad(nivel, colores = {}, descripciones = {}) {
    if (!nivel) return "—";
    const color = colores[nivel] || COLOR_GRAVEDAD[nivel] || "#667085";
    const ayuda = descripciones[nivel] || "";
    return `<span class="badge-gravedad" style="--g:${escapar(color)}"
      ${ayuda ? `data-tip="${escapar(nivel)}: ${escapar(ayuda)}" tabindex="0"` : ""}>
      <span class="punto" aria-hidden="true"></span>
      ${icono(ICONO_GRAVEDAD[nivel] || "info", "ico ico-sm")}
      ${escapar(nivel)}
    </span>`;
  }

  /** Etiqueta Sí / No / — con icono, para columnas booleanas. */
  function etiquetaSiNo(valor, { positivoEsBueno = true } = {}) {
    if (valor === null || valor === undefined) {
      return `<span class="etiqueta etiqueta-neutra">—</span>`;
    }
    const bueno = positivoEsBueno ? valor : !valor;
    return `<span class="etiqueta ${bueno ? "etiqueta-exito" : "etiqueta-aviso"}">
      ${icono(valor ? "check" : "x", "ico ico-sm")}${valor ? "Sí" : "No"}</span>`;
  }

  /** Dibuja la leyenda de niveles de gravedad en Inicio y Configuración. */
  function pintarLeyendaGravedad(catalogos = {}) {
    const colores = catalogos.colores_gravedad || {};
    const descripciones = catalogos.descripcion_gravedad || {};
    const niveles = catalogos.gravedades || Object.keys(COLOR_GRAVEDAD);
    const html = niveles.map((n) => badgeGravedad(n, colores, descripciones)).join("");
    ["#leyenda-gravedad", "#leyenda-gravedad-config"].forEach((id) => {
      const el = sel(id);
      if (el) el.innerHTML = html;
    });
  }

  /** Vista previa del nivel elegido en el formulario de incidencia. */
  function conectarVistaGravedad(catalogos = {}) {
    const selector = sel("#sel-gravedad");
    const vista = sel("#vista-gravedad");
    if (!selector || !vista) return;
    const pintar = () => {
      vista.innerHTML = badgeGravedad(selector.value,
        catalogos.colores_gravedad || {}, catalogos.descripcion_gravedad || {});
    };
    selector.addEventListener("change", pintar);
    sel("#sel-tipo-incidencia")?.addEventListener("change", () => setTimeout(pintar, 0));
    pintar();
  }

  /* =======================================================================
     9. Gráficas: tema visual de Plotly
     Solo cambia colores, tipografía y márgenes. Los datos y el tipo de
     gráfica los sigue definiendo el backend.
  ======================================================================= */
  const PALETA_GRAFICAS = [
    "#068C45", "#134B8D", "#38A169", "#3F7FC1", "#045F35",
    "#7FBF9B", "#93B4D8", "#0F766E", "#A16207", "#6B7280",
  ];

  const PLANTILLA_PLOTLY = {
    layout: {
      colorway: PALETA_GRAFICAS,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: '"Segoe UI", system-ui, sans-serif', size: 12, color: "#1F2933" },
      title: { font: { size: 14, color: "#045F35" }, x: 0.02, xanchor: "left" },
      margin: { l: 56, r: 20, t: 44, b: 48 },
      hoverlabel: {
        bgcolor: "#1F2933",
        bordercolor: "#1F2933",
        font: { color: "#FFFFFF", size: 12, family: '"Segoe UI", system-ui, sans-serif' },
      },
      legend: {
        orientation: "h", y: -0.18, x: 0, xanchor: "left",
        font: { size: 11, color: "#667085" },
        bgcolor: "rgba(0,0,0,0)",
      },
      xaxis: {
        gridcolor: "#EDF1EF", zerolinecolor: "#DDE5E1", linecolor: "#DDE5E1",
        tickfont: { size: 11, color: "#667085" }, automargin: true,
      },
      yaxis: {
        gridcolor: "#EDF1EF", zerolinecolor: "#DDE5E1", linecolor: "#DDE5E1",
        tickfont: { size: 11, color: "#667085" }, automargin: true,
      },
      transition: { duration: 320, easing: "cubic-in-out" },
    },
  };

  const estrecho = () => window.innerWidth < 768;

  /** Acorta un texto largo dejando puntos suspensivos. */
  function abreviar(texto, maximo) {
    const t = String(texto ?? "");
    return t.length > maximo ? t.slice(0, maximo - 1).trimEnd() + "…" : t;
  }

  /**
   * Lee las categorías de un eje. En barras horizontales van en `y`;
   * en el resto, en `x`. Solo interesan cuando son texto.
   */
  function categoriasDe(datos, eje) {
    const valores = [];
    for (const traza of datos || []) {
      const serie = traza[eje];
      if (!Array.isArray(serie)) continue;
      for (const v of serie) if (typeof v === "string" && !valores.includes(v)) valores.push(v);
    }
    return valores;
  }

  /** ¿La gráfica es de barras horizontales? */
  const esHorizontal = (datos) =>
    (datos || []).some((t) => t.type === "bar" && t.orientation === "h");

  /**
   * Devuelve el layout del backend adaptado para que nada se encime:
   *
   *  - El título sale del lienzo (ya está en la cabecera de la tarjeta), que
   *    era la causa principal de que se montara sobre la gráfica.
   *  - Se quitan `height` y `width` fijos: el tamaño lo manda el contenedor,
   *    y así la gráfica no se sale de su tarjeta ni se deforma al
   *    redimensionar la ventana.
   *  - `automargin` en ambos ejes reserva el espacio que necesiten las
   *    etiquetas, y los márgenes base se dejan pequeños para que no sobre.
   *  - Las etiquetas largas se rotan (barras verticales) o se abrevian
   *    (barras horizontales). El nombre completo sigue apareciendo al pasar
   *    el cursor, porque los datos no se tocan.
   *  - La leyenda solo se dibuja si hay más de una serie, y siempre debajo.
   *
   * No se modifica el arreglo `datos`: todos los ajustes son de layout.
   */
  function temaGrafica(layout = {}, datos = []) {
    const l = Object.assign({}, layout);

    // El título vive en la cabecera de la tarjeta (app.js lo reutiliza)
    delete l.title;
    delete l.titlefont;

    // El contenedor manda el tamaño
    delete l.height;
    delete l.width;
    l.autosize = true;

    l.template = PLANTILLA_PLOTLY;
    l.hovermode = l.hovermode || "closest";
    l.showlegend = (datos || []).length > 1;
    l.legend = Object.assign({}, l.legend, {
      orientation: "h", y: -0.22, yanchor: "top", x: 0, xanchor: "left",
      font: { size: estrecho() ? 10 : 11, color: "#667085" },
    });

    // Márgenes pequeños: automargin añade lo que haga falta
    l.margin = Object.assign({ l: 8, r: 12, t: 8, b: 8, pad: 4 }, l.margin, { autoexpand: true });

    const horizontal = esHorizontal(datos);
    const tamTick = estrecho() ? 10 : 11;
    const ejeBase = {
      automargin: true,
      tickfont: { size: tamTick, color: "#667085" },
      gridcolor: "#EDF1EF",
      zerolinecolor: "#DDE5E1",
      linecolor: "#DDE5E1",
    };

    l.xaxis = Object.assign({}, l.xaxis, ejeBase);
    l.yaxis = Object.assign({}, l.yaxis, ejeBase);

    if (horizontal) {
      // Etiquetas largas en el eje vertical: se abrevian para que la gráfica
      // no se quede sin ancho. El texto completo sigue en el tooltip.
      const categorias = categoriasDe(datos, "y");
      const tope = estrecho() ? 14 : 22;
      if (categorias.some((c) => c.length > tope)) {
        l.yaxis.tickmode = "array";
        l.yaxis.tickvals = categorias;
        l.yaxis.ticktext = categorias.map((c) => abreviar(c, tope));
      }
      l.yaxis.ticklabeloverflow = "allow";
    } else {
      // Barras/líneas verticales: se rotan las etiquetas si son largas o si
      // hay muchas, para que no se enciman entre ellas.
      const categorias = categoriasDe(datos, "x");
      const largas = categorias.some((c) => c.length > 8);
      if (categorias.length > 6 || largas) {
        l.xaxis.tickangle = estrecho() ? -55 : -35;
      }
      if (categorias.length > 12) l.xaxis.dtick = 1;
    }

    return l;
  }

  /**
   * Alto en píxeles que necesita una gráfica. Las barras horizontales crecen
   * con el número de categorías: así nunca quedan aplastadas unas sobre
   * otras. La tarjeta crece y la página se desplaza, en vez de encimarse.
   */
  function alturaGrafica(datos = []) {
    const base = estrecho() ? 280 : 330;
    if (!esHorizontal(datos)) return base;
    const cuantas = categoriasDe(datos, "y").length;
    return Math.max(base, Math.min(30 * cuantas + 110, 620));
  }

  /** Configuración común de Plotly (sin barra de herramientas, responsiva). */
  const CONFIG_GRAFICA = {
    responsive: true,
    displayModeBar: false,
    locale: "es",
  };

  function redimensionarGraficas() {
    if (typeof Plotly === "undefined") return;
    sels("#graficas .lienzo > div").forEach((div) => {
      try { Plotly.Plots.resize(div); } catch (_) { /* aún no dibujada */ }
    });
  }

  /* Un ResizeObserver es más fiable que el evento `resize` de la ventana:
     también reacciona a que se contraiga el menú lateral o se pliegue el
     panel de filtros, que cambian el ancho sin cambiar el de la ventana. */
  const vigilante = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => {
        clearTimeout(vigilante._t);
        vigilante._t = setTimeout(redimensionarGraficas, 120);
      })
    : null;

  /** app.js la llama tras dibujar, para que el lienzo quede vigilado. */
  function vigilarGrafica(lienzo) {
    if (vigilante && lienzo) vigilante.observe(lienzo);
  }

  window.addEventListener("resize", () => {
    clearTimeout(redimensionarGraficas._t);
    redimensionarGraficas._t = setTimeout(redimensionarGraficas, 200);
  });

  /* =======================================================================
     10. Esqueletos de carga
  ======================================================================= */
  function esqueletosDashboard() {
    const kpis = sel("#tarjetas-kpi");
    const graficas = sel("#graficas");
    if (kpis) {
      kpis.innerHTML = Array.from({ length: 8 },
        () => `<div class="esqueleto esqueleto-kpi"></div>`).join("");
    }
    if (graficas) {
      graficas.innerHTML = Array.from({ length: 4 },
        () => `<div class="esqueleto esqueleto-grafica"></div>`).join("");
    }
  }

  /* =======================================================================
     Arranque
  ======================================================================= */
  let tablaHistorial = null;
  let tablaClientes = null;

  function iniciar() {
    iniciarMenu();
    iniciarEncabezado();
    iniciarFiltros();
    iniciarFormularios();
    iniciarCamposHora();
    iniciarEvidencias();

    conectarBuscadorDeSelect("#buscar-cliente", "#sel-cliente-servicio");
    conectarBuscadorDeSelect("#buscar-servicio", "#sel-servicio");

    tablaHistorial = crearTabla({
      tabla: "#tabla-historial",
      cuerpo: "#tabla-detalle",
      buscador: "#buscar-historial",
      paginacion: "#paginacion-historial",
      selectorFilas: "#filas-historial",
      conteo: "#conteo-historial",
      sustantivo: ["incidencia", "incidencias"],
    });

    tablaClientes = crearTabla({
      tabla: "#tabla-clientes-tabla",
      cuerpo: "#tabla-clientes",
      buscador: "#buscar-clientes",
      conteo: "#conteo-clientes",
      sustantivo: ["cliente", "clientes"],
    });

    // app.js avisa del cambio de sección escribiendo body[data-seccion]
    new MutationObserver(() => actualizarEncabezado(document.body.dataset.seccion))
      .observe(document.body, { attributes: true, attributeFilter: ["data-seccion"] });

    actualizarEncabezado(document.body.dataset.seccion || "dashboard");
    pintarLeyendaGravedad();
  }

  // El script va al final del <body>: el DOM ya está listo.
  iniciar();

  /* --------------------------- API pública ------------------------------ */
  return {
    icono,
    escapar,
    badgeGravedad,
    etiquetaSiNo,
    pintarLeyendaGravedad,
    conectarVistaGravedad,
    temaGrafica,
    alturaGrafica,
    vigilarGrafica,
    CONFIG_GRAFICA,
    esqueletosDashboard,
    marcarActualizacion,
    actualizarPeriodo,
    pintarFiltrosActivos,
    mostrarResultados,
    redimensionarGraficas,
    get tablaHistorial() { return tablaHistorial; },
    get tablaClientes() { return tablaClientes; },
  };
})();
