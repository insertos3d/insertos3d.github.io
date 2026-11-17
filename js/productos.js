/* =========================================================
   ESTE ES EL ÚNICO ARCHIVO QUE NECESITAS EDITAR A DIARIO
   - CONFIG: tus datos (WhatsApp, redes, distritos)
   - PRODUCTOS: tu catálogo
   Los productos de abajo son EJEMPLOS: cambia nombres, precios y fotos.
   ========================================================= */

const CONFIG = {
  // Base de datos del panel de administrador (Supabase → Project Settings → API).
  // Vacío = la web usa la lista PRODUCTOS de abajo y no registra métricas.
  supabaseUrl: "https://ijqhkpbxvkwnysoepgms.supabase.co",
  supabaseKey: "sb_publishable_lqs__MorKxvB_8pnhy9_BA_ChUM8Egd",   // la llave PÚBLICA (publishable / anon). NUNCA la "secret" ni "service_role".

  // Sección "Explora modelos" (impresión a pedido de modelos de MakerWorld)
  makerworld: {
    url: "https://makerworld.com/",
    modelos: "casi 3 millones",   // fuente: blog oficial de Bambu Lab (nov. 2026). Actualizar si cambia.
  },

  marca: "Insertos 3D",
  eslogan: "Tus Accesorios en 3D",
  // Tu WhatsApp: 51 + número de 9 dígitos, sin espacios ni "+"
  whatsapp: "51943018234",
  moneda: "S/",
  adelanto: 0.5, // 50% para separar el pedido
  igv: 0.18,     // se suma SOLO si el cliente pide factura (los precios de abajo van SIN IGV)
  tiempoFabricacion: "el tiempo de preparación se coordina para la entrega, según el producto y la cantidad",
  notaPreparacion: "Coordinar tiempo de preparación para la entrega", // aparece en TODOS los productos
  // Ruta de entregas semanales (envío más económico, a cargo del comprador)
  distritosEntrega: ["La Molina", "San Borja", "San Isidro", "Miraflores"],
  redes: {
    facebook: "https://www.facebook.com/Insertos3D",
    instagram: "https://www.instagram.com/insertos3d",   // cámbialo por tu usuario real
    tiktok: "https://www.tiktok.com/@insertos3d"          // cámbialo por tu usuario real
  }
};

/* Categorías del menú (el orden aquí es el orden en la web).
   "tendencia" y "temporada" son especiales: muestran los productos marcados con esa etiqueta. */
const CATEGORIAS = [
  { id: "tendencia",      nombre: "Tendencia",       icono: "🔥" },
  { id: "temporada",      nombre: "Temporada",       icono: "⭐" },
  { id: "navidad",        nombre: "Navidad",         icono: "🎄" },
  { id: "religioso",      nombre: "Religioso",       icono: "✝️" },
  { id: "llaveros",       nombre: "Llaveros",        icono: "🔑" },
  { id: "consolas",       nombre: "Consolas",        icono: "🎮" },
  { id: "juegos-de-mesa", nombre: "Juegos de mesa",  icono: "🎲" },
  { id: "personalizados", nombre: "Personalizados",  icono: "✨" }
];

/* Cómo agregar un producto: copia un bloque { ... }, y cambia:
   id        -> único, sin espacios (ej: "estrella-nombre")
   categoria -> uno de los id de CATEGORIAS (navidad, llaveros, ...)
   precio    -> precio unitario en soles
   mayor     -> precio por mayor: desde cuántas unidades y a qué precio (o bórralo)
   mayorConsultar -> en vez de precio fijo por mayor: "precio especial desde X u., consultar"
   cotizar   -> true muestra el botón "Cotizar tamaño o cantidad" (abre WhatsApp)
   fotos     -> lista de fotos extra para la galería (opcional)
   img       -> foto en img/productos/<categoria>/ (ideal: cuadrada 800x800, .webp o .jpg)
   tendencia / temporada / nuevo / agotado -> true o false                          */
const PRODUCTOS = [
  {
    id: "portapapel-papa-noel",
    nombre: "Porta Papel Toalla Navideño · Papá Noel en la Chimenea",
    categoria: "navidad",
    precio: 190,
    cotizar: true,
    img: "img/productos/navidad/portapapel-papa-noel-1.webp",
    fotos: [
      "img/productos/navidad/portapapel-papa-noel-2.webp",
      "img/productos/navidad/portapapel-papa-noel-3.jpg"
    ],
    descripcion: "Las botas de Papá Noel asomando por la chimenea nevada. Impresión 3D a colores en plástico, para rollo de papel toalla estándar. El toque divertido para tu cocina esta Navidad.",
    tendencia: true, temporada: true, nuevo: true
  },
  {
    id: "portapapel-galleta",
    nombre: "Porta Papel Toalla Navideño · Galleta de Jengibre",
    categoria: "navidad",
    precio: 190,
    cotizar: true,
    img: "img/productos/navidad/portapapel-galleta-1.webp",
    fotos: [
      "img/productos/navidad/portapapel-galleta-2.jpg",
      "img/productos/navidad/portapapel-galleta-3.jpg",
      "img/productos/navidad/portapapel-galleta-4.jpg",
      "img/productos/navidad/portapapel-galleta-5.jpg"
    ],
    descripcion: "Galleta de jengibre sobre bases con glaseado de nieve. Impresión 3D a colores en plástico, para rollo de papel toalla estándar. Piezas desmontables: fácil de guardar después de las fiestas.",
    tendencia: true, temporada: true, nuevo: true
  },
  {
    id: "esfera-nombre",
    nombre: "Esfera navideña con nombre",
    categoria: "navidad",
    precio: 12,
    mayor: { desde: 12, precio: 9 },
    img: "img/productos/navidad/esfera-nombre.jpg",
    descripcion: "Personalizada con el nombre que quieras. Ideal para regalo o detalle de empresa.",
    tendencia: true, temporada: true, nuevo: true
  },
  {
    id: "cortador-galletas",
    nombre: "Set cortadores de galletas navideños (4 u.)",
    categoria: "navidad",
    precio: 25,
    mayor: { desde: 6, precio: 20 },
    img: "img/productos/navidad/cortador-galletas.jpg",
    descripcion: "Árbol, estrella, muñeco y bastón. Material apto para cocina (PLA).",
    tendencia: true, temporada: true
  },
  {
    id: "papa-leon-xiv-mini",
    nombre: "Papa León XIV (Mini)",
    categoria: "religioso",
    precio: 12,
    cotizar: true,
    img: "img/productos/religioso/papa-leon-xiv-mini-1-logo.jpg",
    fotos: [
      "img/productos/religioso/papa-leon-xiv-mini-2-logo.jpg",
      "img/productos/religioso/papa-leon-xiv-mini-3-logo.jpg"
    ],
    descripcion: "Figura mini del Papa León XIV saludando, con cruz y base con su nombre. Impresión 3D a colores en plástico. Ideal como recuerdo o detalle para eventos.",
    tendencia: true, nuevo: true
  },
  {
    id: "misterio-nacimiento-3d",
    nombre: "Misterio Nacimiento 3D",
    categoria: "religioso",
    precio: 75,
    mayorConsultar: 6,   // precio especial por cantidad: se cotiza desde 6 u.
    cotizar: true,       // muestra botón "Cotizar tamaño o cantidad"
    img: "img/productos/religioso/misterio-nacimiento-3d.jpg",
    fotos: [             // fotos extra: se ven al tocar la imagen
      "img/productos/religioso/misterio-nacimiento-3d-2.webp",
      "img/productos/religioso/misterio-nacimiento-3d-3.webp",
      "img/productos/religioso/misterio-nacimiento-3d-4.webp"
    ],
    descripcion: "Impresión 3D a colores · 15 cm de altura · plástico. También en tamaño personalizado.",
    tendencia: true, temporada: true, nuevo: true
  },
  {
    id: "llavero-nombre",
    nombre: "Llavero con nombre",
    categoria: "llaveros",
    precio: 8,
    mayor: { desde: 20, precio: 5 },
    img: "img/productos/llaveros/llavero-nombre.jpg",
    descripcion: "Dos colores, tu nombre o logo. Perfecto para recuerdos de cumpleaños y eventos.",
    tendencia: true
  },
  {
    id: "soporte-mandos",
    nombre: "Soporte doble para mandos",
    categoria: "consolas",
    precio: 30,
    img: "img/productos/consolas/soporte-mandos.jpg",
    descripcion: "Ordena tus controles en el escritorio. Varios colores."
  },
  {
    id: "organizador-cartas",
    nombre: "Organizador de cartas y fichas",
    categoria: "juegos-de-mesa",
    precio: 35,
    mayor: { desde: 5, precio: 28 },
    img: "img/productos/juegos-de-mesa/organizador-cartas.jpg",
    descripcion: "Inserto a medida para tu caja. Pregúntanos por tu juego."
  },
  {
    id: "meeples-set",
    nombre: "Set de meeples (10 u.)",
    categoria: "juegos-de-mesa",
    precio: 15,
    img: "img/productos/juegos-de-mesa/meeples-set.jpg",
    descripcion: "Fichas clásicas de juego de mesa en el color que elijas.",
    nuevo: true
  },
  {
    id: "letrero-personalizado",
    nombre: "Letrero o logo personalizado",
    categoria: "personalizados",
    precio: 40,
    img: "img/productos/personalizados/letrero.jpg",
    descripcion: "Precio referencial. Envíanos tu diseño y te cotizamos sin compromiso."
  }
];
