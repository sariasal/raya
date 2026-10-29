# Historia Universal

Línea del tiempo histórica interactiva hecha con HTML, CSS y JavaScript, preparada para publicarse en GitHub Pages.

## Archivos

- `index.html`: estructura de la página.
- `styles.css`: estilos visuales.
- `script.js`: lectura del CSV, filtros, marcadores, fichas, zoom y desplazamiento.
- `events.csv`: datos históricos.
- `README.md`: estas instrucciones.

## Probar el sitio en tu computadora

No abras `index.html` con doble clic: el navegador puede bloquear la lectura de `events.csv` por tratarse de un archivo local.

1. Instala Visual Studio Code.
2. Abre la carpeta del proyecto.
3. Instala la extensión **Live Server**.
4. Haz clic derecho en `index.html` y elige **Open with Live Server**.

También puedes usar cualquier servidor HTTP local sencillo.

## Publicar con GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube los cinco archivos a la raíz del repositorio.
3. En el repositorio, entra en **Settings → Pages**.
4. En la fuente de publicación, elige **Deploy from a branch**, rama `main` y carpeta `/(root)`.
5. Guarda y espera a que finalice la publicación.

## Editar los acontecimientos

Abre `events.csv` con LibreOffice Calc, Excel o un editor de texto. Conserva la primera fila de encabezados y los nombres de columna.

Columnas:

- `id`: identificador único recomendado.
- `title`: nombre del acontecimiento.
- `start`: año inicial.
- `end`: año final; usa el mismo año para un acontecimiento puntual.
- `region`: región o lugar.
- `categories`: categorías separadas por `|` (barra vertical).
- `description`: descripción breve.
- `source`: URL o referencia de la fuente.
- `certainty`: precisión de la fecha, por ejemplo `exacta`, `aproximada` o `convencional`.

### Convención de años

- `-500` significa 500 a. C.
- `-1` significa 1 a. C.
- `1` significa 1 d. C.
- No uses `0` como año histórico. El programa convierte los años para mantener el eje continuo sin año cero.

Para fechas antiguas inciertas, indica que son aproximadas en `certainty` y explica el margen en la descripción cuando resulte útil.

### Reglas CSV

- Guarda el archivo como CSV UTF-8.
- Si un campo contiene comas, ponlo entre comillas dobles.
- Si una descripción contiene comillas dobles, duplícalas.
- No elimines la fila de encabezados.
- Para evitar problemas, no uses saltos de línea dentro de una celda al principio del proyecto.
- Los separadores de categorías son `|`, no comas.

## Limitaciones de esta versión

- GitHub Pages sirve archivos estáticos. La página no puede escribir directamente en el CSV publicado.
- Para modificar datos, edita `events.csv`, guarda y vuelve a subir el archivo al repositorio.
- Los datos de ejemplo son ilustrativos y deben verificarse con fuentes fiables antes de usarse como cronología académica.
- La escala es lineal dentro de cada vista; el zoom cambia el intervalo visible.
- Las etiquetas pueden juntarse cuando hay muchos acontecimientos con fechas muy próximas. Se pueden mejorar los carriles y el diseño en versiones futuras.
- No hay autenticación ni edición desde el navegador.

## Flujo de trabajo recomendado

1. Edita `events.csv`.
2. Prueba la página localmente.
3. Sube los cambios a GitHub.
4. Comprueba la versión publicada.
5. Conserva una copia de seguridad de los datos.
