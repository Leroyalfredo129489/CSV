# Documentación Técnica y Limitaciones - Unified Ads Dashboard (v0.0.2)

## 📌 Propósito de la Herramienta
Este Dashboard es un **Organizador de Datos** diseñado para estructurar y limpiar los archivos CSV desordenados que se extraen de Meta Ads Library mediante la extensión **"Instant Data Scraper"**. Su función principal es transformar estos datos brutos en métricas de marketing accionables, como el **Ad Trust Score** y el **Alcance Inferido**.

---

## 🛠️ Stack Tecnológico Interno
*   **Frontend:** HTML5, Vanilla CSS, JavaScript Asíncrono.
*   **Gráficos:** Chart.js para la visualización de datos.
*   **Backend/Procesamiento:** n8n (Webhook) para la limpieza y estructuración de CSV a Excel.
*   **Almacenamiento:** Google Drive (Repositorio central de archivos limpios).

---

## 🚫 Limitaciones Conocidas (IMPORTANTE)

> [!WARNING]
> **Origen del Código:** Gran parte de la estructura base fue generada mediante técnicas de "Vibe Coding" o IA generativa sin supervisión arquitectónica profunda en sus etapas iniciales. Esto implica limitaciones críticas:

1.  **Procesamiento No Concurrente:** El flujo de n8n **NO soporta archivos múltiples**. Si se suben varios CSV al mismo tiempo, el webhook colapsará o mezclará los datos, resultando en archivos corruptos en Drive.
2.  **Validación de Datos Débil:** El sistema asume que el archivo subido tiene exactamente el formato esperado por el scraper de Meta. Cualquier cambio en la interfaz de Facebook que cambie los encabezados del CSV romperá la visualización.
3.  **Dependencia Externa:** Si la extensión "Instant Data Scraper" deja de funcionar o Meta bloquea el scraping, la herramienta queda inhabilitada ya que no cuenta con un crawler propio integrado.
4.  **Cálculos Basados en Probabilidad:** El "Alcance Inferido" y el "Trust Score" son fórmulas matemáticas estimativas basadas en la longevidad del anuncio, no son datos reales extraídos directamente de la API de Meta (la cual es privada para anuncios de terceros).

---

## 📋 Reglas de Uso para el Operador
1.  **Regla de Oro:** 1 archivo a la vez. Esperar a que el archivo aparezca en Google Drive antes de subir el siguiente.
2.  **Formato:** Solo subir archivos `.xlsx` procesados por el flujo oficial en la sección de "Importar Excel".
3.  **Navegador:** Optimizado exclusivamente para Google Chrome debido a la dependencia de la extensión de scraping.
4.  **Frecuencia de Scraping:** La extracción de datos debe realizarse de forma **MANUAL**. Dado que la información en la Biblioteca de Anuncios no cambia constantemente ni requiere monitoreo al segundo, no es necesario (ni recomendable) intentar automatizar la extracción masiva; basta con un scraping puntual cuando se necesite refrescar el análisis.

---

## 🔒 Notas de Seguridad
*   No se almacenan credenciales de usuario en el frontend.
*   Los enlaces a Google Drive y extensiones son estáticos y deben ser actualizados manualmente en el `index.html` si cambian.

---
*Documento generado para el control de calidad del proyecto Unified Ads.*
