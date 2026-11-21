/* Panel de administrador de Insertos 3D (usa Supabase). */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
  const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const CATS = CATEGORIAS.filter((c) => c.id !== "tendencia" && c.id !== "temporada");
  const nombreCat = (id) => (CATS.find((c) => c.id === id) || { nombre: id }).nombre;
  const BASE = location.origin + location.pathname.replace(/admin\.html$/, "");

  let tAviso;
  function aviso(txt) {
    const el = $("#toast"); el.textContent = txt; el.classList.add("ver");
    clearTimeout(tAviso); tAviso = setTimeout(() => el.classList.remove("ver"), 2400);
  }

  // ---------- "Ojito" para ver la contraseña ----------
  $("#verPass").addEventListener("click", () => {
    const inp = $("#lPass"), ver = inp.type === "password";
    inp.type = ver ? "text" : "password";
    $("#verPass").setAttribute("aria-pressed", String(ver));
    $("#verPass").setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
    $("#verPass").title = ver ? "Ocultar contraseña" : "Mostrar contraseña";
    inp.focus();
  });

  // ---------- Conexión ----------
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey || !window.supabase) {
    $("#vLogin").hidden = false; $("#sinConfig").hidden = false; $("#fLogin").hidden = true;
    return;
  }
  const sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

  let productos = [];
  let met30 = {}; // { id: { vista, whatsapp, ... } }

  // ---------- Login ----------
  async function entrar() {
    const { data } = await sb.auth.getSession();
    if (!data.session) { $("#vLogin").hidden = false; $("#vPanel").hidden = true; return; }
    const { data: esAdmin } = await sb.rpc("es_admin");
    if (!esAdmin) {
      await sb.auth.signOut();
      $("#vLogin").hidden = false; $("#lError").textContent = "Este usuario no es administrador.";
      return;
    }
    $("#vLogin").hidden = true; $("#vPanel").hidden = false;
    await Promise.all([cargarProductos(), cargarMet30()]);
    pintarLista(); pintarDestinos(); pintarLink();
  }
  // Espera progresiva tras intentos fallidos (frena pruebas a mano en este navegador).
  // La protección real está en el servidor (límite por IP de Supabase) y en la contraseña fuerte.
  const BLOQ_KEY = "panel3d-intentos";
  const leerBloq = () => { try { return JSON.parse(localStorage.getItem(BLOQ_KEY)) || { fallos: 0, hasta: 0 }; } catch (e) { return { fallos: 0, hasta: 0 }; } };
  const guardarBloq = (b) => { try { localStorage.setItem(BLOQ_KEY, JSON.stringify(b)); } catch (e) {} };
  let tBloq = null;
  function mostrarBloqueo() {
    clearInterval(tBloq);
    const tick = () => {
      const s = Math.ceil((leerBloq().hasta - Date.now()) / 1000);
      const boton = $("#lBoton");
      if (s > 0) {
        boton.disabled = true;
        boton.textContent = `Espera ${s >= 60 ? Math.ceil(s / 60) + " min" : s + " s"}`;
        $("#lError").textContent = "Demasiados intentos fallidos. Por seguridad, espera antes de volver a intentar.";
      } else {
        clearInterval(tBloq); boton.disabled = false; boton.textContent = "Ingresar";
      }
    };
    tick(); tBloq = setInterval(tick, 1000);
  }
  if (leerBloq().hasta > Date.now()) mostrarBloqueo();

  $("#fLogin").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#lError").textContent = "";
    if (leerBloq().hasta > Date.now()) return mostrarBloqueo();
    $("#lBoton").disabled = true; $("#lBoton").textContent = "Ingresando…";
    const { error } = await sb.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
    $("#lBoton").disabled = false; $("#lBoton").textContent = "Ingresar";
    if (error) {
      if (error.status === 429 || /rate limit|too many/i.test(error.message || "")) {
        $("#lError").textContent = "Demasiados intentos desde tu conexión. Espera unos minutos y vuelve a intentar.";
        return;
      }
      const b = leerBloq(); b.fallos += 1;
      // A partir del 3.er fallo: 30 s, 1 min, 2 min, 4 min… hasta 15 min
      if (b.fallos >= 3) { b.hasta = Date.now() + Math.min(30000 * 2 ** (b.fallos - 3), 15 * 60000); }
      guardarBloq(b);
      $("#lError").textContent = "Correo o contraseña incorrectos." + (b.fallos >= 3 ? "" : ` (intento ${b.fallos} de 3)`);
      $("#lPass").value = "";
      if (b.hasta > Date.now()) mostrarBloqueo();
      return;
    }
    guardarBloq({ fallos: 0, hasta: 0 });
    $("#lPass").value = ""; $("#lPass").type = "password"; $("#verPass").setAttribute("aria-pressed", "false");
    entrar();
  });
  $("#salir").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });

  // ---------- Pestañas ----------
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activo", x === b));
    ["productos", "metricas", "links"].forEach((t) => { $("#t" + t[0].toUpperCase() + t.slice(1)).hidden = t !== b.dataset.tab; });
    if (b.dataset.tab === "metricas") cargarMetricas();
  }));

  // ---------- Productos ----------
  async function cargarProductos() {
    const { data, error } = await sb.from("productos").select("*").order("orden").order("nombre");
    if (error) { aviso("Error al cargar productos"); return; }
    productos = data;
    $("#importar").hidden = productos.length > 0;
  }
  async function cargarMet30() {
    const { data } = await sb.rpc("metricas", { dias: 30 });
    met30 = {};
    (data || []).forEach((r) => {
      if (!r.producto_id) return;
      met30[r.producto_id] = met30[r.producto_id] || {};
      met30[r.producto_id][r.tipo] = (met30[r.producto_id][r.tipo] || 0) + Number(r.total);
    });
  }

  $("#pCat").innerHTML = `<option value="">Todas las categorías</option>` + CATS.map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join("");
  ["#pBuscar", "#pCat"].forEach((s) => $(s).addEventListener("input", pintarLista));

  // ---------- Filtros (estado + etiquetas, combinables) ----------
  let estadoFiltro = "";            // "" | "on" | "off"
  const tagsFiltro = new Set();     // tendencia, temporada, nuevo, agotado, sinfoto (se combinan con Y)
  document.querySelectorAll("[data-estado]").forEach((b) => b.addEventListener("click", () => {
    estadoFiltro = b.dataset.estado;
    document.querySelectorAll("[data-estado]").forEach((x) => x.classList.toggle("activo", x === b));
    pintarLista();
  }));
  document.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => {
    const t = b.dataset.tag;
    tagsFiltro.has(t) ? tagsFiltro.delete(t) : tagsFiltro.add(t);
    b.classList.toggle("activo", tagsFiltro.has(t));
    pintarLista();
  }));
  $("#pLimpiar").addEventListener("click", () => {
    estadoFiltro = ""; tagsFiltro.clear(); $("#pBuscar").value = ""; $("#pCat").value = "";
    document.querySelectorAll("[data-estado]").forEach((x) => x.classList.toggle("activo", x.dataset.estado === ""));
    document.querySelectorAll("[data-tag]").forEach((x) => x.classList.remove("activo"));
    pintarLista();
  });
  const cumpleTag = (p, t) => (t === "sinfoto" ? !p.img : !!p[t]);
  function filtrados() {
    const q = $("#pBuscar").value.trim().toLowerCase(), cat = $("#pCat").value;
    return productos.filter((p) =>
      (!q || (p.nombre + " " + p.id).toLowerCase().includes(q)) &&
      (!cat || p.categoria === cat) &&
      (!estadoFiltro || (estadoFiltro === "on" ? p.activo : !p.activo)) &&
      [...tagsFiltro].every((t) => cumpleTag(p, t)));
  }

  const TOGGLES = [["activo", "Visible"], ["tendencia", "🔥 Tendencia"], ["temporada", "⭐ Temporada"], ["nuevo", "Nuevo"], ["agotado", "Agotado"]];
  function pintarLista() {
    const lista = filtrados();
    const hayFiltro = !!(estadoFiltro || tagsFiltro.size || $("#pBuscar").value.trim() || $("#pCat").value);
    $("#pConteo").textContent = `Mostrando ${lista.length} de ${productos.length} productos`;
    $("#pLimpiar").hidden = !hayFiltro;
    $("#lista").innerHTML = lista.map((p) => {
      const m = met30[p.id] || {};
      return `<div class="fila-p ${p.activo ? "" : "off"}" data-id="${esc(p.id)}">
        <button class="asa" data-asa aria-label="Arrastrar para ordenar ${esc(p.nombre)}" title="Arrastra para ordenar">⠿</button>
        <div class="mini">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.replaceWith('📦')">` : "📦"}</div>
        <div>
          <h4>${esc(p.nombre)}</h4>
          <small><code>${esc(p.id)}</code> · ${esc(nombreCat(p.categoria))} · ${soles(p.precio)} · 👁 ${m.vista || 0} · 💬 ${(m.whatsapp || 0) + (m.cotizar || 0)}</small>
          <div class="toggles">${TOGGLES.map(([k, t]) =>
            `<button class="tg ${p[k] ? "on" : ""} ${k === "agotado" ? "rojo" : ""}" data-tg="${k}" data-id="${esc(p.id)}">${t}</button>`).join("")}</div>
        </div>
        <div class="acciones-fila">
          <button class="btn-mini" data-arriba="${esc(p.id)}" title="Subir al primer lugar" aria-label="Subir al primer lugar">⤒</button>
          <button class="btn btn-ghost" data-editar="${esc(p.id)}" style="padding:8px 12px">Editar</button>
        </div>
      </div>`;
    }).join("") || `<p class="nota">No hay productos con ese filtro.</p>`;
  }

  // ---------- Ordenar (arrastrar y soltar con mouse o dedo) ----------
  // Guarda el orden completo: los productos visibles en la lista (con filtros) se reubican
  // en las posiciones que ya ocupaban dentro del catálogo; el resto no se mueve.
  async function guardarOrden(idsVisibles) {
    const set = new Set(idsVisibles);
    const completo = productos.map((p) => p.id);
    const huecos = completo.map((id, i) => (set.has(id) ? i : -1)).filter((i) => i >= 0);
    huecos.forEach((pos, k) => { completo[pos] = idsVisibles[k]; });
    await enviarOrden(completo);
  }
  async function enviarOrden(ids) {
    const { error } = await sb.rpc("reordenar_productos", { ids });
    if (error) { aviso("No se pudo guardar el orden"); }
    else { aviso("Orden guardado ✓"); }
    await cargarProductos(); pintarLista();
  }

  let drag = null, espera = null;
  const filas = () => [...document.querySelectorAll("#lista .fila-p")];
  function iniciarArrastre(fila, asa, pointerId) {
    drag = { fila, asa, orden0: filas().map((f) => f.dataset.id).join() };
    fila.classList.remove("presionando");
    fila.classList.add("arrastrando");
    document.body.classList.add("ordenando");
    try { asa.setPointerCapture(pointerId); } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(25);
  }
  $("#lista").addEventListener("pointerdown", (e) => {
    const asa = e.target.closest("[data-asa]"); if (!asa) return;
    e.preventDefault();
    const fila = asa.closest(".fila-p");
    if (e.pointerType === "mouse") return iniciarArrastre(fila, asa, e.pointerId);
    // Celular / tablet: mantener presionado 250 ms para empezar a mover
    fila.classList.add("presionando");
    espera = { fila, x: e.clientX, y: e.clientY, t: setTimeout(() => { espera = null; iniciarArrastre(fila, asa, e.pointerId); }, 250) };
  });
  document.addEventListener("pointermove", (e) => {
    if (espera && Math.hypot(e.clientX - espera.x, e.clientY - espera.y) > 10) {
      clearTimeout(espera.t); espera.fila.classList.remove("presionando"); espera = null;
    }
    if (!drag) return;
    e.preventDefault();
    // ¿Sobre qué fila está el puntero? (ignora la que se arrastra)
    const bajo = document.elementsFromPoint(e.clientX, e.clientY)
      .map((el) => el.closest && el.closest("#lista .fila-p")).find((f) => f && f !== drag.fila);
    if (bajo) {
      const r = bajo.getBoundingClientRect();
      const antes = e.clientY < r.top + r.height / 2;
      bajo.parentNode.insertBefore(drag.fila, antes ? bajo : bajo.nextSibling);
    }
    // Desplazamiento automático cerca de los bordes de la pantalla
    if (e.clientY < 90) window.scrollBy(0, -14);
    else if (e.clientY > innerHeight - 90) window.scrollBy(0, 14);
  }, { passive: false });
  function soltar() {
    if (espera) { clearTimeout(espera.t); espera.fila.classList.remove("presionando"); espera = null; }
    if (!drag) return;
    const { fila, orden0 } = drag; drag = null;
    fila.classList.remove("arrastrando"); document.body.classList.remove("ordenando");
    const ids = filas().map((f) => f.dataset.id);
    if (ids.join() !== orden0) guardarOrden(ids);
  }
  document.addEventListener("pointerup", soltar);
  document.addEventListener("pointercancel", soltar);

  $("#lista").addEventListener("click", async (e) => {
    const arriba = e.target.closest("[data-arriba]");
    if (arriba) {
      const id = arriba.dataset.arriba;
      if (productos[0] && productos[0].id === id) return aviso("Ya está en el primer lugar");
      return enviarOrden([id, ...productos.map((p) => p.id).filter((x) => x !== id)]);
    }
    const tg = e.target.closest("[data-tg]");
    if (tg) {
      const p = productos.find((x) => x.id === tg.dataset.id), k = tg.dataset.tg, val = !p[k];
      tg.disabled = true;
      const { error } = await sb.from("productos").update({ [k]: val }).eq("id", p.id);
      tg.disabled = false;
      if (error) return aviso("No se pudo guardar");
      p[k] = val; pintarLista(); aviso("Guardado ✓");
    }
    const ed = e.target.closest("[data-editar]");
    if (ed) abrirEditor(productos.find((x) => x.id === ed.dataset.editar));
  });

  $("#btnImportar").addEventListener("click", async () => {
    const filas = PRODUCTOS.map((p, i) => ({
      id: p.id, nombre: p.nombre, categoria: p.categoria, precio: p.precio,
      mayor_desde: p.mayor ? p.mayor.desde : null, mayor_precio: p.mayor ? p.mayor.precio : null,
      mayor_consultar: p.mayorConsultar || null, cotizar: !!p.cotizar, img: p.img || null, fotos: p.fotos || [],
      descripcion: p.descripcion || null, tendencia: !!p.tendencia, temporada: !!p.temporada,
      nuevo: !!p.nuevo, agotado: !!p.agotado, activo: true, orden: (i + 1) * 10
    }));
    const { error } = await sb.from("productos").upsert(filas, { onConflict: "id" });
    if (error) return aviso("Error al importar: " + error.message);
    aviso(`${filas.length} productos importados ✓`);
    await cargarProductos(); pintarLista(); pintarDestinos();
  });

  // ---------- Editor ----------
  let edit = null; // producto en edición (null = nuevo)
  let fotosEd = [];
  let idManual = false; // si el usuario tocó el ID, ya no se autogenera desde el nombre
  const ID_OK = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  $("#eNombre").addEventListener("input", () => { if (!idManual) $("#eId").value = slug($("#eNombre").value); });
  $("#eId").addEventListener("input", () => { idManual = true; });
  $("#eCategoria").innerHTML = CATS.map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join("");
  $("#nuevo").addEventListener("click", () => abrirEditor(null));

  function abrirEditor(p) {
    edit = p;
    $("#eTitulo").textContent = p ? "Editar producto" : "Nuevo producto";
    $("#eNombre").value = p ? p.nombre : "";
    $("#eId").value = p ? p.id : "";
    idManual = !!p;
    $("#eIdNota").textContent = p
      ? "⚠️ Cambiar el ID rompe los links ya publicados (?p=) y separa sus métricas anteriores. Cámbialo solo si es necesario."
      : "Se genera solo a partir del nombre; puedes ajustarlo antes de guardar.";
    $("#eCategoria").value = p ? p.categoria : CATS[0].id;
    $("#ePrecio").value = p ? p.precio : "";
    $("#eMayorDesde").value = p && p.mayor_desde ? p.mayor_desde : "";
    $("#eMayorPrecio").value = p && p.mayor_precio ? p.mayor_precio : "";
    $("#eMayorConsultar").value = p && p.mayor_consultar ? p.mayor_consultar : "";
    $("#eDesc").value = p ? p.descripcion || "" : "";
    $("#eActivo").checked = p ? p.activo : true;
    ["tendencia", "temporada", "nuevo", "agotado", "cotizar"].forEach((k) => {
      $("#e" + k[0].toUpperCase() + k.slice(1)).checked = p ? !!p[k] : k === "nuevo" || k === "cotizar";
    });
    // Nuevo producto: aparece primero (orden menor que el actual primero)
    $("#eOrden").value = p ? p.orden : (productos.length ? Math.min(...productos.map((x) => x.orden)) - 10 : 10);
    fotosEd = p ? [p.img, ...(p.fotos || [])].filter(Boolean) : [];
    $("#eBorrar").hidden = !p;
    $("#eError").textContent = ""; $("#eSubiendo").textContent = ""; $("#eFotoError").textContent = "";
    subiendo = 0; estadoSubida();
    pintarFotosEd();
    $("#editor").hidden = false;
  }
  const cerrarEditor = () => { $("#editor").hidden = true; };
  $("#eCancelar").addEventListener("click", cerrarEditor);
  $("#editor").addEventListener("click", (e) => { if (e.target.id === "editor") cerrarEditor(); });

  function pintarFotosEd() {
    $("#eFotos").innerHTML = fotosEd.map((src, i) => `<figure class="${i ? "" : "principal"}">
      <img src="${esc(src)}" alt="">
      <div>
        <button type="button" data-ppal="${i}" title="Hacer principal">${i ? "☆" : "★"}</button>
        <button type="button" data-quitar="${i}" title="Quitar">✕</button>
      </div></figure>`).join("") || `<span class="nota">Sin fotos todavía.</span>`;
  }
  $("#eFotos").addEventListener("click", (e) => {
    const pp = e.target.closest("[data-ppal]"), qq = e.target.closest("[data-quitar]");
    if (pp) { const i = +pp.dataset.ppal; fotosEd.unshift(fotosEd.splice(i, 1)[0]); pintarFotosEd(); }
    if (qq) { fotosEd.splice(+qq.dataset.quitar, 1); pintarFotosEd(); }
  });

  // Logo para la marca de agua (mismo dominio: no "ensucia" el canvas)
  const logo = new Image();
  logo.src = "img/marca/logo.png";

  // Abre la foto con el método disponible (algunos celulares fallan con createImageBitmap)
  async function decodificar(file) {
    try { return await createImageBitmap(file); } catch (e) { /* se intenta con <img> */ }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch (e) {
      throw new Error("el formato de la foto no es compatible. En iPhone: Ajustes → Cámara → Formatos → “Más compatible”.");
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  const aBlob = (c, tipo, q) => new Promise((res) => c.toBlob(res, tipo, q));

  // Achica la foto (máx. 1200 px), pone el logo en la esquina y la convierte a WebP (o JPG si el celular no soporta WebP)
  async function achicar(file, conMarca) {
    const bmp = await decodificar(file);
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const r = Math.min(1, 1200 / Math.max(w0, h0));
    const c = document.createElement("canvas");
    c.width = Math.round(w0 * r); c.height = Math.round(h0 * r);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    if (conMarca && logo.complete && logo.naturalWidth) {
      const t = Math.round(Math.min(c.width, c.height) * 0.14), m = Math.round(t * 0.25);
      const cx = m + t / 2, cy = c.height - m - t / 2;   // esquina inferior izquierda
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(cx, cy, t / 2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(logo, cx - t / 2, cy - t / 2, t, t);
      ctx.restore();
    }
    // WebP si el navegador lo soporta; si no (iPhone antiguo), JPG. Nunca PNG: pesa demasiado.
    let blob = await aBlob(c, "image/webp", 0.82);
    if (!blob || blob.type !== "image/webp") blob = await aBlob(c, "image/jpeg", 0.85);
    if (!blob) throw new Error("el celular no pudo procesar la foto (memoria). Prueba con una foto más pequeña.");
    return blob;
  }

  // Traduce los errores técnicos a mensajes claros
  function errorAmigable(err) {
    const m = String((err && (err.message || err.error)) || err || "");
    if (/mime|content.?type/i.test(m)) return "formato no permitido (usa JPG, PNG o WebP).";
    if (/size|exceed|too large|413/i.test(m)) return "la foto pesa más de 5 MB.";
    if (/row-level|security|unauthor|403|401|jwt/i.test(m)) return "tu sesión venció o no tienes permiso. Sal del panel y vuelve a entrar.";
    if (/network|fetch|failed to fetch|timeout/i.test(m)) return "sin conexión o conexión lenta. Revisa tu internet e inténtalo otra vez.";
    return m || "error desconocido.";
  }

  let subiendo = 0; // fotos en proceso: mientras sea > 0 no se puede guardar
  function estadoSubida() {
    const b = $("#fEditor button[type=submit]");
    b.disabled = subiendo > 0;
    b.textContent = subiendo > 0 ? "Subiendo fotos…" : "Guardar";
  }
  $("#eSubir").addEventListener("change", async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    if (!files.length) return;
    const carpeta = slug($("#eId").value || $("#eNombre").value) || "sin-nombre";
    const errores = [];
    subiendo += files.length; estadoSubida();
    $("#eFotoError").textContent = "";
    for (let i = 0; i < files.length; i++) {
      $("#eSubiendo").textContent = `⏳ Subiendo foto ${i + 1} de ${files.length}… no cierres ni guardes todavía`;
      try {
        const blob = await achicar(files[i], $("#eMarca").checked);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        // "-logo" en el nombre = la foto ya trae el logo grabado (la web no le pone el logo flotante encima)
        const ruta = `${carpeta}/${Date.now()}-${i}${$("#eMarca").checked ? "-logo" : ""}.${ext}`;
        const { error } = await sb.storage.from("productos").upload(ruta, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw error;
        fotosEd.push(sb.storage.from("productos").getPublicUrl(ruta).data.publicUrl);
        pintarFotosEd();
      } catch (err) {
        errores.push(`Foto ${i + 1} (${files[i].name || "sin nombre"}): ${errorAmigable(err)}`);
      } finally {
        subiendo--; estadoSubida();
      }
    }
    $("#eSubiendo").textContent = errores.length ? "" : `✓ ${files.length} foto(s) lista(s). Ahora presiona Guardar.`;
    if (errores.length) {
      $("#eFotoError").textContent = "⚠️ No se pudo subir:\n" + errores.join("\n");
      alert("⚠️ Algunas fotos no se subieron:\n\n" + errores.join("\n"));
    }
  });

  $("#fEditor").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#eError").textContent = "";
    if (subiendo > 0) { $("#eError").textContent = "Espera a que terminen de subir las fotos."; return; }
    if (!fotosEd.length && !confirm("Este producto no tiene fotos y en la web se verá solo un ícono.\n\n¿Guardar de todas formas?")) return;
    const num = (s) => ($(s).value === "" ? null : Number($(s).value));
    const fila = {
      nombre: $("#eNombre").value.trim(), categoria: $("#eCategoria").value, precio: num("#ePrecio") || 0,
      mayor_desde: num("#eMayorDesde"), mayor_precio: num("#eMayorPrecio"), mayor_consultar: num("#eMayorConsultar"),
      descripcion: $("#eDesc").value.trim() || null, activo: $("#eActivo").checked, tendencia: $("#eTendencia").checked,
      temporada: $("#eTemporada").checked, nuevo: $("#eNuevo").checked, agotado: $("#eAgotado").checked,
      cotizar: $("#eCotizar").checked, orden: num("#eOrden") ?? 100,
      img: fotosEd[0] || null, fotos: fotosEd.slice(1)
    };
    if ((fila.mayor_desde && !fila.mayor_precio) || (!fila.mayor_desde && fila.mayor_precio)) {
      $("#eError").textContent = "Para precio por mayor llena las dos casillas (desde y precio), o déjalas vacías."; return;
    }
    const nuevoId = $("#eId").value.trim();
    if (!ID_OK.test(nuevoId) || nuevoId.length > 80) {
      $("#eError").textContent = "ID inválido: usa solo minúsculas, números y guiones (ej. porta-papel-galleta)."; return;
    }
    const cambiaId = edit && nuevoId !== edit.id;
    if ((!edit || cambiaId) && productos.some((p) => p.id === nuevoId)) {
      $("#eError").textContent = `Ya existe un producto con el ID "${nuevoId}". Elige otro.`; return;
    }
    if (cambiaId && !confirm(`¿Cambiar el ID de "${edit.id}" a "${nuevoId}"?\n\nLos links publicados con el ID anterior dejarán de abrir este producto.`)) return;
    let error;
    if (edit) ({ error } = await sb.from("productos").update(cambiaId ? { id: nuevoId, ...fila } : fila).eq("id", edit.id));
    else ({ error } = await sb.from("productos").insert({ id: nuevoId, ...fila }));
    if (error) {
      const msg = /check constraint/i.test(error.message)
        ? "Revisa los datos: precio no negativo, por mayor desde 2 unidades, máx. 12 fotos."
        : error.message;
      $("#eError").textContent = "No se pudo guardar: " + msg; return;
    }
    cerrarEditor(); aviso("Producto guardado ✓");
    await cargarProductos(); pintarLista(); pintarDestinos();
  });

  $("#eBorrar").addEventListener("click", async () => {
    if (!edit || !confirm(`¿Eliminar "${edit.nombre}" para siempre?\n\nSi solo quieres ocultarlo, desmarca "Visible".`)) return;
    const { error } = await sb.from("productos").delete().eq("id", edit.id);
    if (error) return aviso("No se pudo eliminar");
    cerrarEditor(); aviso("Eliminado");
    await cargarProductos(); pintarLista(); pintarDestinos();
  });

  // ---------- Métricas ----------
  $("#mDias").addEventListener("change", cargarMetricas);
  $("#mRecargar").addEventListener("click", cargarMetricas);
  async function cargarMetricas() {
    const { data, error } = await sb.rpc("metricas", { dias: Number($("#mDias").value) });
    if (error) { aviso("Error al cargar métricas"); return; }
    const tot = {}, porProd = {}, porOrigen = {};
    (data || []).forEach((r) => {
      const n = Number(r.total);
      tot[r.tipo] = (tot[r.tipo] || 0) + n;
      if (r.producto_id) {
        porProd[r.producto_id] = porProd[r.producto_id] || {};
        porProd[r.producto_id][r.tipo] = (porProd[r.producto_id][r.tipo] || 0) + n;
      }
      porOrigen[r.origen] = porOrigen[r.origen] || {};
      porOrigen[r.origen][r.tipo] = (porOrigen[r.origen][r.tipo] || 0) + n;
    });
    const k = (v, t) => `<div class="kpi"><b>${v || 0}</b><span>${t}</span></div>`;
    $("#kpis").innerHTML = k(tot.visita, "Visitas a la web") + k(tot.vista, "Productos vistos") + k(tot.fotos, "Fotos abiertas") +
      k(tot.carrito, "Agregados al carrito") + k(tot.whatsapp, "💬 Clics enviar pedido") + k(tot.cotizar, "💬 Clics cotizar") +
      k(tot.enlace, "🌐 Clics a MakerWorld");

    const nombre = (id) => {
      const p = productos.find((x) => x.id === id);
      return p ? p.nombre : ({
        "por-mayor": "📦 Cotizar por mayor (general)",
        "personalizado": "✨ Cotizar personalizado (general)",
        "makerworld": "🌐 MakerWorld (explorar = vistas · cotizar modelo)"
      })[id] || id;
    };
    const filas = Object.entries(porProd).map(([id, m]) => ({ id, ...m, vista: (m.vista || 0) + (m.enlace || 0), wsp: (m.whatsapp || 0) + (m.cotizar || 0) }))
      .sort((a, b) => b.wsp - a.wsp || (b.vista || 0) - (a.vista || 0));
    $("#tablaProd").innerHTML = `<tr><th>Producto</th><th>👁 Vistas</th><th>📷 Fotos</th><th>🛒 Carrito</th><th>💬 Pedido</th><th>💬 Cotizar</th><th>% interés</th></tr>` +
      (filas.map((f) => `<tr><td>${esc(nombre(f.id))}</td><td>${f.vista || 0}</td><td>${f.fotos || 0}</td><td>${f.carrito || 0}</td>
        <td>${f.whatsapp || 0}</td><td>${f.cotizar || 0}</td><td>${f.vista ? Math.round((f.wsp / f.vista) * 100) + "%" : "–"}</td></tr>`).join("")
        || `<tr><td colspan="7" class="nota">Aún no hay datos en este periodo.</td></tr>`);

    const orig = Object.entries(porOrigen).map(([o, m]) => ({ o, ...m, wsp: (m.whatsapp || 0) + (m.cotizar || 0) }))
      .sort((a, b) => (b.visita || 0) - (a.visita || 0));
    $("#tablaOrigen").innerHTML = `<tr><th>Origen</th><th>Visitas</th><th>👁 Vistas</th><th>🛒 Carrito</th><th>💬 WhatsApp</th></tr>` +
      (orig.map((f) => `<tr><td>${esc(f.o)}</td><td>${f.visita || 0}</td><td>${f.vista || 0}</td><td>${f.carrito || 0}</td><td>${f.wsp}</td></tr>`).join("")
        || `<tr><td colspan="5" class="nota">Aún no hay datos en este periodo.</td></tr>`);
  }

  // ---------- Links para publicaciones ----------
  function pintarDestinos() {
    $("#kDestino").innerHTML = `<option value="">🏠 Página principal</option>` +
      `<optgroup label="Categorías">${CATEGORIAS.map((c) => `<option value="#${c.id}">${c.icono} ${c.nombre}</option>`).join("")}</optgroup>` +
      `<optgroup label="Productos (abre sus fotos)">${productos.filter((p) => p.activo).map((p) => `<option value="p:${esc(p.id)}">${esc(p.nombre)}</option>`).join("")}</optgroup>`;
  }
  function linkActual() {
    const src = slug($("#kSrc").value).slice(0, 60), d = $("#kDestino").value;
    const qs = new URLSearchParams();
    if (d.startsWith("p:")) qs.set("p", d.slice(2));
    if (src) qs.set("src", src);
    const q = qs.toString();
    return BASE + (q ? "?" + q : "") + (d.startsWith("#") ? d : "");
  }
  function pintarLink() { $("#kLink").textContent = linkActual(); }
  ["#kSrc", "#kDestino"].forEach((s) => $(s).addEventListener("input", pintarLink));
  $("#kCopiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(linkActual()); aviso("Link copiado ✓"); }
    catch (e) { aviso("Selecciona el link y cópialo"); }
  });

  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { $("#vPanel").hidden = true; $("#vLogin").hidden = false; } });
  entrar();
})();
