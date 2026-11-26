# Mi Agenda — agenda de papel para tablet Android

App hecha con **React Native + Expo SDK 58**, pensada para tablet en horizontal: cada día es una hoja de agenda abierta (página izquierda y derecha con anillas). Se puede escribir con teclado o a mano (lápiz óptico o dedo), pegar post-its y stickers, y tiene recordatorios que **suenan** aunque la app esté cerrada.

Todo se guarda **solo en la tablet** (SQLite), con exportación e importación de backups.

## Qué trae

| Sección | Contenido |
|---|---|
| 📖 **Día** | Encabezado con fecha, semana, día del año, fase lunar, feriados de Argentina y cumpleaños. Horario 07–22 h, 3 prioridades, 7 tareas con casilla, notas rayadas, agua, ánimo y gratitud. Las horas muestran los recordatorios; tocá una hora para crear uno. |
| 🗓️ **Semana** | 7 casilleros (lunes a domingo) con recordatorios, cumpleaños, feriados, la prioridad del día y espacio libre. Objetivos de la semana. |
| 📅 **Mes** | Calendario mensual con todo lo anterior, metas del mes y notas. Tocá un día para abrirlo y mantené presionado para agregar un recordatorio. |
| 🗂️ **Año** | Los 12 meses con marcas de recordatorios, cumpleaños y feriados. |
| 🔔 **Avisos** | Lista de recordatorios (próximos, repetitivos, pasados). Se repiten una vez, a diario, de lunes a viernes, cada semana, mes o año. Aviso anticipado, colores y botones en la notificación: *Posponer 10 min* y *Hecho*. |
| 📇 **Contactos** | Libreta con buscador, llamada, WhatsApp, email y cumpleaños (suena un aviso ese día a las 9:00). |
| ☑️ **Listas** | Listas con casillas (compras, pendientes, libros…). |
| 🔥 **Hábitos** | Seguimiento mensual con racha. |
| 🎯 **Metas** | Metas del año y del mes con progreso, palabra del año, áreas de la vida y reflexión mensual. |
| 📚 **Cuadernos** | Biblioteca con carpetas, búsqueda en todo el contenido y notas fijadas. Tipos: **Cuaderno** (varias hojas que se pasan con animación, papel rayado, cuadriculado, punteado o liso), **Reunión** (fecha, lugar, asistentes, objetivo, notas, decisiones, tareas con responsable y fecha que se pueden convertir en recordatorio, y grabación con transcripción; se comparte como acta), **Pizarra** (lienzo infinito con zoom y desplazamiento con dos dedos), **Documento** (títulos, viñetas, numeradas, casillas, citas, negrita, cursiva y subrayado; se exporta a Markdown), **PDF** (importás un PDF, escribís encima y exportás el PDF anotado) y **Grabación** (audio con transcripción automática en español). |
| ⚡ **Nota rápida** | Botón amarillo arriba de las pestañas: anotás una idea y la guardás, la pegás como post-it en el día de hoy o la convertís en recordatorio. |
| 💰 **Gastos** | Ingresos y gastos por categoría, con totales y saldo del mes. |
| ⚙️ **Ajustes** | Modo solo lápiz, prueba de sonido, permisos, alarmas exactas y backup. |

**Pasar de hoja:** con ⌨️ activo, deslizá el dedo sobre la hoja y la página te sigue como en una agenda de papel (soltala antes de la mitad y vuelve; pasada la mitad o con un movimiento rápido, se da vuelta). Mientras escribís a mano, usá los bordes o las esquinas dobladas. La tapa también se abre arrastrándola.

**Escritura a mano:** ✒️ pluma (el trazo varía con la presión del lápiz óptico y se suaviza) y 🖊️ birome (trazo parejo).

**Barra de herramientas de cada hoja** (Día, Semana, Mes y Notas): ⌨️ teclado · ✏️ lápiz (7 colores, 4 grosores) · 🖍️ resaltador · 🧽 goma · ↶ deshacer · 🗑️ borrar dibujos · 🟨 post-it (se arrastra, cambia de color y de tamaño) · ⭐ stickers.

## Cómo generar el APK

Requisitos: Node 20 o superior y una cuenta gratuita de Expo.

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Cuando termine, EAS te da un link (y un QR) para descargar el `.apk`. Abrilo desde la tablet e instalalo (Android te va a pedir permiso para "instalar apps de origen desconocido").

### Alternativa local (con Android Studio instalado)

```bash
npm install
npx expo run:android --variant release
```

Con la tablet conectada por USB y la depuración USB activada.

> ⚠️ **No uses Expo Go** para probarla: el sonido personalizado, las alarmas exactas y Skia necesitan una compilación propia (APK o development build).

## Primer uso en la tablet

1. Aceptá el permiso de **notificaciones**.
2. En **Ajustes ⚙️ → Alarmas exactas**, si aparece el aviso, tocá *Habilitar*.
3. En **Ajustes ⚙️ → Batería → Abrir ajustes**, poné la app como **"Sin restricciones"**. En Samsung, Xiaomi y Motorola esto es clave para que los avisos suenen a horario.
4. Tocá **🔔 Probar** para escuchar el sonido.
5. Si usás lápiz óptico, activá **Solo lápiz óptico** para que la mano apoyada no deje marcas.

## Estructura

```
App.tsx                    pestañas índice + pantallas
src/db.ts                  SQLite, mini store reactivo, páginas y backup
src/notifications.ts       canal con sonido, programación, posponer y cumpleaños
src/dates.ts               utilidades de fecha, feriados AR y fases lunares
src/occurs.ts              qué recordatorios caen en cada día (repeticiones)
src/components/InkPage.tsx hoja con tinta (Skia), herramientas y post-its
src/components/PaperBg.tsx fondos de papel y anillas
src/components/ReminderModal.tsx
src/components/InkTools.tsx   herramientas, capa de tinta (presión, zoom) y post-its
src/components/Recorder.tsx   grabación + transcripción
src/screens/notebook/*        editores: cuaderno, reunión, pizarra, documento, PDF, grabación
modules/pdf-renderer/         módulo nativo (Kotlin) para leer y generar PDF
src/screens/*              Día, Semana, Mes, Año, Avisos, Contactos, Listas, Hábitos, Metas, Notas, Gastos, Ajustes
assets/sounds/campanita.wav sonido del recordatorio (reemplazable por otro .wav con el mismo nombre)
```

## Notas

- La orientación está fija en **horizontal**, porque los trazos se guardan en coordenadas de pantalla.
- Para cambiar el sonido, reemplazá `assets/sounds/campanita.wav` y volvé a compilar. Si ya estaba instalada, desinstalala antes, porque Android guarda el sonido del canal.
- La transcripción usa el reconocimiento de voz de Google del sistema. Grabar y transcribir al mismo tiempo requiere **Android 13 o superior**; en equipos más viejos se graba solo el audio.
- La copia de seguridad no incluye los PDF importados ni los audios.
- Los feriados nacionales se calculan solos (incluye Carnaval y Semana Santa). Los trasladables se muestran en su fecha nominal.
