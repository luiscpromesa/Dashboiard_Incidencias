# Documentacion del frontend

## 1. Objetivo de la aplicacion

Este proyecto es el frontend del **Sistema de Incidencias Logisticas de Grupo PROMESA**. Es un dashboard web que permite registrar servicios de recoleccion, registrar y documentar incidencias, consultar indicadores, dar seguimiento a incidencias abiertas, administrar catalogos y descargar reportes.

El frontend no guarda la informacion principal por si mismo. Se comunica con un backend remoto, configurado en `js/config.js`, y ese backend se encarga de la persistencia. Los comentarios de `index.html` indican que el backend esta desplegado en Render y que utiliza Firebase, pero el backend y Firebase no forman parte de este workspace.

### Funcionalidades principales

- Acceso mediante un token o contrasena.
- Persistencia local del token para mantener la sesion en ese navegador.
- Dashboard con KPIs, graficas y detalle de incidencias.
- Filtros por fecha, periodo, cliente, categoria, estado, gravedad y otros criterios.
- Registro de servicios con o sin incidencias.
- Registro y edicion de incidencias.
- Carga de evidencias en imagenes o PDF.
- Bandeja de incidencias pendientes.
- Historial con busqueda, ordenamiento y paginacion local.
- Administracion de clientes.
- Administracion de tipos de incidencia.
- Alta de opciones de catalogo desde el formulario de clientes.
- Generacion y descarga de reportes Excel.
- Interfaz adaptable a escritorio, tablet y movil.

## 2. Tipo de proyecto y tecnologias

Es una aplicacion web estatica hecha con **HTML, CSS y JavaScript vanilla**. No utiliza un framework como React, Vue o Angular y no tiene un proceso de compilacion visible.

### Dependencias externas

- **Bootstrap 5.3.3**: estilos y componentes base, cargado desde jsDelivr.
- **Plotly 2.32.0**: graficas del dashboard, cargado desde `cdn.plot.ly`.
- **SVG inline**: los iconos se declaran en `index.html` mediante un sprite propio; no se usa una libreria de iconos.

### APIs nativas del navegador utilizadas

- `fetch`: llamadas al backend.
- `localStorage`: token de acceso y preferencia de menu.
- `FormData`: formularios y subida multipart de evidencias.
- `URLSearchParams`: parametros de reportes.
- `Blob` y `URL.createObjectURL`: descarga de archivos Excel.
- `MutationObserver`: reaccionar al cambio de seccion para actualizar el encabezado.
- `ResizeObserver`: recalcular el tamano de las graficas.
- `DataTransfer`: apoyo al arrastrar y soltar evidencias.
- `matchMedia`: comportamiento responsive.

No hay `package.json`, `node_modules`, TypeScript, bundler, pruebas automatizadas ni configuracion de linting en la estructura revisada.

## 3. Estructura del proyecto

```text
Dashboiard_Incidencias/
|-- index.html
|-- README.md
|-- DOCUMENTACION_FRONTEND.md
|-- css/
|   |-- base.css
|   |-- layout.css
|   |-- componentes.css
|   `-- estilos.css
|-- js/
|   |-- config.js
|   |-- api.js
|   |-- ui.js
|   `-- app.js
`-- static/
    `-- img/
        |-- logo_promesa.png
        `-- isotipo_promesa.png
```

## 4. Desglose de carpetas y archivos

### Raiz

#### `index.html`

Es el punto de entrada de la aplicacion y contiene la estructura completa de la interfaz.

Incluye:

- Metadatos HTML, titulo, favicon y descripcion.
- Carga de Bootstrap y Plotly desde CDN.
- Carga ordenada de los cuatro CSS propios.
- Sprite SVG con los iconos usados por menus, botones, estados y avisos.
- Pantalla de acceso identificada por `#acceso`.
- Armazon principal identificado por `#app-shell`.
- Menu lateral de navegacion.
- Barra superior con titulo, periodo, ultima actualizacion y acciones.
- Panel de filtros para dashboard e historial.
- Secciones de contenido identificadas con `#seccion-*`.
- Contenedores donde JavaScript inserta KPIs, graficas, tablas, pendientes y avisos.
- Indicador global de carga.
- Orden de carga de scripts.

Las secciones funcionales son:

- `inicio`: bienvenida y accesos rapidos.
- `dashboard`: indicadores, graficas y resumen.
- `servicio`: alta de servicios de recoleccion.
- `incidencia`: alta y edicion de incidencias.
- `pendientes`: incidencias abiertas y acciones para atenderlas.
- `historial`: detalle historico filtrable.
- `clientes`: alta, edicion y consulta de clientes.
- `reportes`: seleccion y descarga de reportes.
- `tipos`: administracion de tipos de incidencia y datos de sesion.

El HTML define principalmente la estructura fija. El contenido de resultados se genera posteriormente desde `app.js`.

#### `README.md`

Es el README original del proyecto. En la version revisada solo contiene el titulo del proyecto, por lo que no sustituye esta documentacion tecnica.

#### `DOCUMENTACION_FRONTEND.md`

Este archivo. Explica la arquitectura, los archivos, el flujo de ejecucion, la comunicacion con el backend y las limitaciones que pueden comprobarse desde el frontend.

### `css/`

Los estilos se cargan desde lo mas general hacia lo mas especifico:

`base.css` -> `layout.css` -> `componentes.css` -> `estilos.css`.

#### `css/base.css`

Define los fundamentos visuales y utilidades generales:

- Variables CSS de colores, tipografia, tamanos, radios y sombras.
- Estilos base del documento, textos, encabezados, enlaces y codigo.
- Estilos del sprite y de los iconos SVG.
- Accesibilidad, foco visible y salto al contenido.
- Clase `.oculto` para ocultar elementos.
- Utilidades de filas de acciones.
- Animaciones generales y respeto de `prefers-reduced-motion`.

#### `css/layout.css`

Define la distribucion global de la pantalla:

- Grid principal con barra lateral y zona de contenido.
- Menu lateral expandido, contraido y abierto en movil.
- Barra superior fija o sticky.
- Area principal y espaciados.
- Panel de filtros.
- Rejillas de KPIs y graficas.
- Breakpoints para tablet y movil.
- Fondo superpuesto para el menu movil.

Las clases de estado mas importantes son `.lateral-contraido`, `.lateral-abierto` y `.abierto`.

#### `css/componentes.css`

Contiene estilos reutilizables para componentes de la interfaz:

- Tarjetas y KPIs.
- Badges de gravedad.
- Etiquetas de estado.
- Botones y controles de formularios.
- Campos de hora.
- Mensajes de validacion.
- Zona de carga de evidencias.
- Tablas, buscadores y paginacion.
- Avisos tipo toast.
- Esqueletos de carga.
- Tooltips.
- Estados vacios.
- Contenedores de graficas.
- Pantalla de acceso.
- Indicador global de carga.

#### `css/estilos.css`

Agrupa ajustes ligados a pantallas concretas:

- Chips de filtros activos.
- Pantalla de inicio.
- Buscadores de clientes y servicios.
- Alturas y presentacion de tablas.
- Elementos de reportes.
- Reglas especificas para impresion.

### `js/`

Los scripts se cargan en este orden:

1. `config.js`
2. `api.js`
3. `ui.js`
4. `app.js`

El orden es importante: `app.js` utiliza `CONFIG`, `API` y el objeto `UI` creados por los archivos anteriores.

#### `js/config.js`

Es la configuracion editable del frontend.

Define:

- `CONFIG.API_URL`: URL base del backend.
- `CONFIG.CLAVE_TOKEN`: nombre de la clave usada en `localStorage`.

Actualmente la URL configurada es:

```text
https://backend-qp3b.onrender.com
```

El token no se escribe en este archivo. La pantalla de acceso lo solicita al usuario y lo guarda en el navegador. Para cambiar de backend, normalmente solo debe modificarse `API_URL`, sin agregar una diagonal final.

#### `js/api.js`

Es la capa de comunicacion HTTP. Centraliza las solicitudes para que el resto de la aplicacion no tenga que repetir logica de `fetch`, encabezados y manejo de errores.

Funciones principales del objeto global `API`:

- `obtenerToken()`: lee el token desde `localStorage`.
- `guardarToken(token)`: guarda el token.
- `borrarToken()`: elimina el token.
- `peticion(ruta, opciones)`: ejecuta una solicitud generica.
- `get(ruta)`: hace una solicitud GET y devuelve JSON.
- `post(ruta, datos)`: envia JSON mediante POST.
- `put(ruta, datos)`: envia JSON mediante PUT.
- `subirArchivos(ruta, archivos)`: envia evidencias usando `FormData`.
- `descargarReporte(parametros)`: solicita un Excel y fuerza su descarga.

Comportamiento de seguridad y errores:

- Las solicitudes distintas de GET reciben el encabezado `X-API-Token`.
- Una respuesta `401` borra el token local y obliga a volver a iniciar sesion.
- Los errores de red muestran un mensaje indicando que Render puede estar despertando.
- Los errores HTTP intentan leer el campo `error` de la respuesta JSON.
- La subida de archivos no define manualmente `Content-Type`, porque el navegador debe generar el boundary multipart.

#### `js/ui.js`

Es la capa visual y de interaccion. No consulta el backend ni calcula los indicadores. Se carga antes que `app.js` y publica `window.UI`.

`app.js` obtiene ese objeto con `window.UI || null` y llama sus funciones de forma opcional. Esto permite que la logica principal no falle por completo si la capa visual no llegara a cargar.

Responsabilidades:

1. Catalogo de secciones, titulos y descripciones.
2. Menu lateral expandible, contraible y responsive.
3. Menu de usuario y cierre de sesion.
4. Encabezado superior, periodo y hora de actualizacion.
5. Panel de filtros y chips de filtros activos.
6. Tablas con busqueda local, ordenamiento y paginacion.
7. Validacion visual de formularios.
8. Aviso de cambios sin guardar.
9. Autocompletado y mejoras de seleccion.
10. Arrastrar, soltar y previsualizar evidencias.
11. Badges, leyendas y colores de gravedad.
12. Tema y redimensionamiento de graficas Plotly.
13. Esqueletos y estados de carga.

Funciones publicas importantes incluyen `icono`, `escapar`, `badgeGravedad`, `etiquetaSiNo`, `temaGrafica` y controladores de tablas como `tablaHistorial` y `tablaClientes`.

La busqueda, ordenamiento y paginacion de tablas ocurre en el navegador sobre las filas ya recibidas; no genera una nueva consulta al servidor.

#### `js/app.js`

Es el coordinador principal y contiene la logica de negocio del frontend.

Responsabilidades:

- Controlar la autenticacion.
- Mantener el estado en memoria.
- Navegar entre secciones.
- Cargar catalogos, clientes y tipos.
- Construir filtros dinamicos.
- Consultar y pintar el dashboard.
- Crear y enviar servicios.
- Crear, editar y resolver incidencias.
- Gestionar evidencias.
- Pintar pendientes, clientes y tipos.
- Preparar y descargar reportes.
- Conectar botones y formularios con `API` y `UI`.

Estado principal mantenido en memoria:

- `CATALOGOS`: gravedades, estados, categorias, frecuencias y otras listas.
- `CLIENTES`: clientes recibidos del backend.
- `TIPOS`: tipos de incidencia.
- `SERVICIOS`: servicios disponibles para asociar una incidencia.
- `OPCIONES_REPORTE`: opciones para generar reportes.
- `DETALLE`: incidencias mostradas en el historial.
- `PENDIENTES`: incidencias abiertas.
- `EDITANDO_INCIDENCIA`: evita solicitudes duplicadas durante una edicion.

## 5. Flujo completo de la aplicacion

### 5.1 Carga del documento

1. El navegador carga `index.html`.
2. Se descargan Bootstrap y Plotly.
3. Se aplican los cuatro archivos CSS en orden.
4. Se crea el sprite SVG de iconos.
5. Se monta la pantalla de acceso y el armazon de la aplicacion.
6. Se cargan `config.js`, `api.js`, `ui.js` y `app.js`.
7. `ui.js` conecta listeners de menu, filtros, formularios, tablas y evidencias.
8. `app.js` revisa si existe un token guardado.

### 5.2 Inicio de sesion

Si no hay token, se muestra `#acceso` y se oculta el armazon principal.

Cuando el usuario pulsa **Entrar** o presiona Enter:

1. Se lee `#campo-token`.
2. Se rechaza el valor vacio.
3. Se guarda el token bajo `incidencias_token`.
4. Se ejecuta `iniciar()`.

`iniciar()` solicita catalogos, clientes y tipos. Si las solicitudes tienen exito, llena los selectores y muestra el dashboard. Si falla, vuelve a mostrar la pantalla de acceso y presenta el error.

### 5.3 Navegacion

La funcion `irA(seccion)`:

1. Oculta todas las secciones de `main`.
2. Muestra `#seccion-{nombre}`.
3. Marca el enlace de navegacion activo.
4. Actualiza `body.dataset.seccion`.
5. Lleva el scroll al inicio.
6. Carga los datos correspondientes a la seccion.

Segun la seccion, puede llamar a:

- `cargarDashboard()` para dashboard e historial.
- `cargarServiciosEnSelect()` para registrar una incidencia.
- `cargarPendientes()` para pendientes.
- `pintarClientes()` para clientes.
- `pintarTipos()` para tipos.
- `cargarOpcionesReporte()` para reportes.

`ui.js` observa el atributo `data-seccion` y actualiza el titulo, la descripcion, el titulo del documento y la visibilidad del panel de filtros.

### 5.4 Dashboard e historial

El formulario de filtros permite elegir fechas y filtros dinamicos. Al aplicar los filtros:

1. `app.js` serializa el formulario.
2. Solicita `/api/dashboard` con query parameters.
3. Muestra KPIs, graficas y detalle.
4. Actualiza el periodo y la hora de consulta.
5. `ui.js` aplica busqueda, ordenamiento y paginacion sobre el detalle recibido.

Dashboard e historial usan la misma consulta, pero cada pantalla presenta la informacion con un enfoque distinto.

### 5.5 Formularios

Los formularios se definen en `index.html`, se validan visualmente en `ui.js` y se envian al backend desde `app.js`.

Antes de guardar, la interfaz puede:

- Marcar campos requeridos invalidos.
- Mostrar el mensaje junto al campo.
- Detectar cambios sin guardar.
- Confirmar antes de abandonar un formulario modificado.
- Actualizar campos dependientes, como gravedad sugerida por tipo.

### 5.6 Evidencias

Las evidencias se seleccionan mediante el campo de archivo o arrastrando archivos a la zona correspondiente.

`ui.js` se encarga de la experiencia local:

- Detectar archivos.
- Mostrar vista previa cuando es posible.
- Mostrar nombre y estado de los archivos.
- Permitir quitar archivos antes del envio.

`api.js` los envia como `multipart/form-data` mediante `subirArchivos()`. La ruta concreta de asociacion se construye en `app.js` con el identificador de la incidencia.

### 5.7 Pendientes y resolucion

La seccion de pendientes consulta las incidencias abiertas. Desde ahi se puede abrir una incidencia para editarla o resolverla. `app.js` conserva la lista en `PENDIENTES` para que los botones de accion puedan localizar el registro correcto.

### 5.8 Reportes

La pantalla de reportes primero carga las opciones disponibles. Al solicitar un reporte:

1. Se convierten las opciones en query parameters.
2. `API.descargarReporte()` solicita el archivo.
3. La respuesta se lee como `Blob`.
4. Se obtiene el nombre desde `Content-Disposition` si existe.
5. Se crea un enlace temporal y se dispara la descarga.

## 6. Comunicacion con el backend

Todas las rutas se concatenan con `CONFIG.API_URL`.

| Metodo | Ruta | Uso |
|---|---|---|
| GET | `/api/catalogos` | Carga de listas y configuraciones de catalogo. |
| GET | `/api/clientes` | Consulta de clientes. |
| POST | `/api/clientes` | Creacion de cliente. |
| PUT | `/api/clientes/{id}` | Edicion de cliente existente. |
| GET | `/api/tipos` | Consulta de tipos de incidencia. |
| POST | `/api/tipos` | Creacion de tipo de incidencia. |
| POST | `/api/catalogos/{catalogo}/opciones` | Agregar una opcion de categoria, estado o frecuencia. |
| GET | `/api/dashboard?...` | KPIs, graficas y detalle con filtros. |
| POST | `/api/servicios` | Registro de servicio. |
| GET | `/api/servicios?limite=60` | Servicios recientes para asociarlos a incidencias. |
| POST | `/api/incidencias` | Registro de incidencia. |
| PUT | `/api/incidencias/{id}` | Edicion de incidencia. |
| GET | `/api/incidencias?abiertas=1` | Consulta de incidencias pendientes. |
| POST | `/api/incidencias/{id}/resolver` | Cierre o resolucion de incidencia. |
| POST | `/api/incidencias/{id}/evidencias` | Subida de evidencias. |
| GET | `/api/reportes/opciones` | Opciones disponibles para reportes. |
| GET | `/api/reportes/generar?...` | Generacion y descarga de Excel. |

### Datos que el frontend espera

Catalogos:

- `tipos_servicio`
- `resultados`
- `categorias`
- `estados`
- `frecuencias`
- `gravedades`
- `descripcion_gravedad`
- `colores_gravedad`
- `tipos_reporte`

Clientes suelen incluir:

- `id`
- `nombre`
- `categoria`
- `estado`
- `frecuencia`
- `activo` o `estatus`
- `cobro_por_recoleccion`

Tipos de incidencia suelen incluir:

- `id`
- `nombre`
- `descripcion`
- `gravedad_default`

La respuesta del dashboard se consume con bloques como `opciones`, `kpis`, `graficas` y `detalle`. Las respuestas de escritura pueden incluir `id`, `mensaje`, `valores`, `valor`, `creada`, `subidas`, `rechazadas` y `errores`, segun la operacion.

## 7. Relacion entre las capas

```text
index.html
  |-- estructura fija, formularios y contenedores
  |-- carga config.js, api.js, ui.js y app.js
  |
  +--> base.css / layout.css / componentes.css / estilos.css
  |      estilos, responsive, estados visuales
  |
  +--> config.js
  |      URL del backend y clave del token
  |
  +--> api.js
  |      fetch, token, errores, JSON, archivos y descargas
  |
  +--> ui.js
  |      menu, tablas, validacion, evidencias, Plotly y utilidades visuales
  |
  `--> app.js
         estado, navegacion, formularios, consultas y pintado de datos
```

Puntos de montaje relevantes del HTML:

- `#tarjetas-kpi`: tarjetas de indicadores.
- `#graficas`: graficas Plotly.
- `#tabla-detalle`: tabla de historial o detalle.
- `#lista-pendientes`: incidencias abiertas.
- `#tabla-clientes`: clientes.
- `#tabla-tipos`: tipos de incidencia.
- `#avisos`: mensajes de exito, informacion y error.
- `#cargando`: indicador global de carga.
- `#contenedor-filtros`: filtros generados por JavaScript.

Clases y atributos que conectan logica y estilos:

- `.oculto`: visibilidad.
- `.activa`: navegacion seleccionada.
- `.lateral-contraido` y `.lateral-abierto`: menu responsive.
- `.abierto`: panel de filtros.
- `.critica`: resaltado de gravedad alta.
- `.a-tarjetas`: tablas adaptadas a movil.
- `.invalido` y `.mensaje-error`: validacion.
- `.tarjeta-grafica`, `.lienzo`: graficas.
- `.esqueleto-*`: carga progresiva.

## 8. Como ejecutar el frontend

Al ser un frontend estatico, no requiere instalacion de paquetes para abrir la interfaz.

Opciones habituales:

- Abrir `index.html` directamente en un navegador.
- Usar una extension de servidor local, como Live Server, para evitar restricciones del protocolo `file://`.
- Publicarlo en un hosting estatico como GitHub Pages.

Para que los datos funcionen deben cumplirse estas condiciones:

1. `CONFIG.API_URL` debe apuntar al backend correcto.
2. El backend debe estar disponible.
3. El backend debe permitir el origen del frontend mediante CORS.
4. El token introducido debe ser valido.
5. El backend debe exponer las rutas y formatos esperados.
6. El navegador debe poder acceder a las CDN de Bootstrap y Plotly.

La primera consulta puede tardar porque el servicio de Render puede estar dormido en un plan gratuito.

## 9. Sesion, seguridad y limites

- El token se guarda en `localStorage` con la clave `incidencias_token`.
- El token no aparece escrito en `config.js` ni debe publicarse en el repositorio.
- Cualquier JavaScript que se ejecute en el mismo origen podria leer un token almacenado en `localStorage`; es una decision practica del frontend, no un almacenamiento de maxima seguridad.
- Las lecturas GET no agregan el encabezado de token en `api.js`; POST y PUT si lo agregan.
- El frontend escapa muchos textos dinamicos antes de insertarlos en HTML mediante `UI.escapar`, pero la seguridad tambien depende de las validaciones del backend.
- El backend no esta incluido, por lo que este repositorio no permite verificar sus reglas de autorizacion, persistencia, CORS, limites de archivos o calculo de indicadores.
- No se observa una separacion automatica entre entornos de desarrollo, pruebas y produccion.
- No hay pruebas automatizadas ni validacion formal del contrato de la API.
- La compresion de imagenes mencionada en algunos comentarios no aparece implementada en los archivos del frontend revisados; podria realizarse en el backend o estar pendiente de sincronizacion.

## 10. Resumen rapido

- `index.html` define la pantalla y los puntos donde se insertan datos.
- `css/` define la apariencia, el layout, los componentes y los ajustes responsive.
- `config.js` define a que backend conectarse.
- `api.js` centraliza todas las peticiones y descargas.
- `ui.js` controla la experiencia visual y la interaccion del navegador.
- `app.js` controla el estado, la navegacion, los formularios y la logica funcional.
- `static/img/` contiene el logo e isotipo de Grupo PROMESA.
- El backend remoto es indispensable para consultar y guardar informacion.
