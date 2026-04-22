# PesosTrack 💪

Seguimiento visual del progreso de pérdida de peso y medidas corporales — **Gema** y **Jorge**.

## ¿Qué hace?

- **Pestañas independientes**: una para Jorge (muslo derecho) y otra para Gema (muslo izquierdo).
- **Registro y edición**: añade, edita y borra registros diarios o semanales de peso, muslo, cintura, cadera y pecho con control de fecha y hora exacta.
- **Estadísticas en tiempo real**: último valor y progreso (subida/bajada) respecto a la medición anterior.
- **Gráficas interactivas avanzadas (Chart.js)**: dos gráficas separadas (Peso en kg y Medidas en cm) con soporte para cambiar entre formato de *Líneas* y *Barras*, además de ocultar/mostrar métricas individuales.
- **100% Responsive / Mobile First**: diseño adaptable a móviles con menú superior fijo y componentes fluidos, siguiendo el mismo estilo premium que el proyecto *Bancos*.
- **Sync con GitHub Gist** — misma mecánica que BancoComp: PAT + Gist ID, datos sincronizados en la nube y accesibles desde cualquier dispositivo.
- **Modo oscuro / claro** con persistencia.
- **Exportar / Importar JSON** para backup o inyección manual de datos.

## Estructura de archivos

```
pesos/
├── index.html
├── css/
│   ├── variables.css   ← tokens de diseño
│   ├── layout.css      ← header, secciones, footer
│   ├── components.css  ← tabla, stats, barras, botones
│   └── modals.css      ← modales y responsive
└── js/
    ├── db.js     ← IndexedDB (local)
    ├── gist.js   ← GitHub Gist API
    ├── ui.js     ← renderizado
    └── app.js    ← lógica principal
```

## Datos por persona

| Campo | Gema | Jorge |
|---|---|---|
| Peso (kg) | ✓ | ✓ |
| Muslo (cm) | Izquierdo | Derecho |
| Cintura (cm) | ✓ | ✓ |
| Cadera (cm) | ✓ | ✓ |
| Pecho (cm) | ✓ | ✓ |

## Sync con GitHub Gist

1. Crea un PAT en [github.com/settings/tokens](https://github.com/settings/tokens?type=beta) con permiso **Gists: Read and write**.
2. Pulsa **Gist Sync** en el header.
3. Pega el token y deja el ID vacío para crear un Gist nuevo, o pega un ID existente para cargar datos previos.

Los datos se guardan en el archivo `pesostrack-data.json` dentro del Gist privado.