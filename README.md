<div align="center">
  <img src="static/img/logo_promesa.png" alt="Grupo PROMESA Logo" width="250"/>
  <h1>Sistema de Incidencias Logísticas | Frontend</h1>
  <p><strong>Plataforma web de monitoreo, registro y gestión de operaciones logísticas</strong></p>
</div>

---

## 📌 Descripción del Proyecto

Este repositorio contiene la capa de presentación (Frontend) del **Sistema de Incidencias Logísticas** desarrollado para **Grupo PROMESA**. Su objetivo principal es proveer una interfaz centralizada, intuitiva y en tiempo real para que las áreas operativas y de Recursos Humanos puedan registrar servicios de recolección, documentar incidencias operativas, administrar catálogos y consultar indicadores clave de rendimiento (KPIs).

La arquitectura está diseñada bajo un enfoque **"Vanilla" y modular**, garantizando un rendimiento óptimo, compatibilidad multiplataforma y una carga ultrarrápida sin la sobrecarga de frameworks complejos.

---

## ✨ Características Principales

* 📊 **Dashboard Dinámico y Analítico:** Visualización interactiva de KPIs y gráficas (Plotly.js) que responden en tiempo real a múltiples filtros (fecha, cliente, gravedad, etc.).
* 📝 **Gestión de Servicios e Incidencias:** Formularios asíncronos con validación visual en tiempo real y prevención de pérdida de datos por cierres accidentales.
* 🗂️ **Administración de Catálogos:** Capacidad de agregar clientes, tipos de incidencia y ampliar opciones de catálogo (frecuencias, estados) de manera dinámica.
* 📎 **Gestión de Evidencias:** Módulo de *Drag & Drop* integrado para la carga intuitiva de evidencias multimedia (imágenes y PDFs) con previsualización en el navegador.
* 🔍 **Procesamiento de Tablas en Cliente:** Búsqueda, ordenamiento y paginación de datos ejecutados completamente en la memoria del navegador para una respuesta instantánea sin sobrecargar el servidor.
* 📱 **Diseño 100% Responsivo:** Interfaz adaptable (Desktop, Tablet, Mobile) apoyada en `matchMedia` y `ResizeObserver`.

---

## 🛠️ Stack Tecnológico

| Tecnología | Rol en el Proyecto |
| :--- | :--- |
| **HTML5** | Estructura semántica y base de la aplicación. |
| **CSS3** | Estilos modulares, variables CSS (Custom Properties) y diseño adaptativo. |
| **JavaScript (ES6+)** | Lógica de negocio, consumo de API, gestión del DOM y manejo del estado. |
| **Bootstrap 5.3.3** | Framework CSS cargado vía CDN para el sistema de grillas y componentes UI base. |
| **Plotly 2.32.0** | Librería especializada para la renderización de gráficos y visualización de datos. |

*(Nota: El proyecto no utiliza bundlers como Webpack o Vite, ni preprocesadores, lo que facilita su despliegue en cualquier entorno de hosting estático).*

---

## 📂 Arquitectura y Estructura de Archivos

El código está estrictamente separado por responsabilidades, asegurando escalabilidad y fácil mantenimiento:

```text
Dashboiard_Incidencias/
├── index.html                 # Punto de entrada y armazón (App Shell) de la UI.
├── css/
│   ├── base.css               # Variables, tipografía y utilidades globales.
│   ├── layout.css             # Estructura del grid, menú lateral y breakpoints.
│   ├── componentes.css        # Estilos reutilizables (tarjetas, botones, inputs).
│   └── estilos.css            # Reglas específicas de vistas y ajustes finos.
├── js/
│   ├── config.js              # Variables de entorno y URL del backend.
│   ├── api.js                 # Capa de red (Fetch API), gestión de tokens y errores.
│   ├── ui.js                  # Controladores visuales, modales, alertas y gráficas.
│   └── app.js                 # Lógica de negocio, estado local y comunicación de vistas.
└── static/img/                # Activos estáticos corporativos (Logos/Isotipos).
```

---

## 💻 Guía de Desarrollo Local

Al ser un proyecto estático puro, su ejecución local es directa:

1. **Clonar el repositorio:**

```bash
git clone https://github.com/luiscpromesa/Dashboiard_Incidencias.git
```

2. **Configurar el endpoint del Backend:**
Abre `js/config.js` y asegúrate de apuntar a tu servidor local durante el desarrollo:

```javascript
const CONFIG = {
    API_URL: "http://localhost:5000", // Cambiar a URL de Producción al hacer deploy
    CLAVE_TOKEN: "incidencias_token"
};
```

3. **Ejecutar:**
Inicia un servidor local (por ejemplo, usando la extensión *Live Server* en VS Code o `python -m http.server`) y abre `index.html` en el navegador.

---

## 🔒 Seguridad y Sesiones

El sistema implementa un esquema de acceso protegido por token:

* La autenticación inicial requiere un "Token de Acceso" que se valida contra el Backend.
* El token se almacena de forma temporal en el `localStorage` del navegador.
* Todas las peticiones HTTP que alteran datos (`POST`, `PUT`, `DELETE`) adjuntan automáticamente este token en los *Headers* a través de la capa `api.js`.