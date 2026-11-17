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
  $("#fLogin").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#lError").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
    if (error) { $("#lError").textContent = "Correo o contraseña incorrectos."; return; }
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
  ["#pBuscar", "#pCat", "#pEstado"].forEach((s) => $(s).addEventListener("input", pintarLista));

  const TOGGLES = [["activo", "Visible"], ["tendencia", "🔥 Tendencia"], ["temporada", "⭐ Temporada"], ["nuevo", "Nuevo"], ["agotado", "Agotado"]];
  function pintarLista() {
    const q = $("#pBuscar").value.trim().toLowerCase(), cat = $("#pCat").value, est = $("#pEstado").value;
    const lista = productos.filter((p) => (!q || p.nombre.toLowerCase().includes(q)) && (!cat || p.categoria === cat) &&
      (!est || (est === "on" ? p.activo : !p.activo)));
    $("#lista").innerHTML = lista.map((p) => {
      const m = met30[p.id] || {};
      return `<div class="fila-p ${p.activo ? "" : "off"}">
        <div class="mini">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : "📦"}</div>
        <div>
          <h4>${esc(p.nombre)}</h4>
          <small>${esc(nombreCat(p.categoria))} · ${soles(p.precio)} · 👁 ${m.vista || 0} · 💬 ${(m.whatsapp || 0) + (m.cotizar || 0)}</small>
          <div class="toggles">${TOGGLES.map(([k, t]) =>
            `<button class="tg ${p[k] ? "on" : ""} ${k === "agotado" ? "rojo" : ""}" data-tg="${k}" data-id="${esc(p.id)}">${t}</button>`).join("")}</div>
        </div>
        <button class="btn btn-ghost" data-editar="${esc(p.id)}" style="padding:8px 12px">Editar</button>
      </div>`;
    }).join("") || `<p class="nota">No hay productos con ese filtro.</p>`;
  }
  $("#lista").addEventListener("click", async (e) => {
    const tg = e.target.closest("[data-tg]");
    if (tg) {
      const p = productos.find((x) => x.id === tg.dataset.id), k = tg.dataset.tg, val = !p[k];
      tg.disabled = true;
      const { error } = await sb.from("productos").update({ [k]: val, actualizado: new Date().toISOString() }).eq("id", p.id);
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
  $("#eCategoria").innerHTML = CATS.map((c) => `<option value="${c.id}">${c.icono} ${c.nombre}</option>`).join("");
  $("#nuevo").addEventListener("click", () => abrirEditor(null));

  function abrirEditor(p) {
    edit = p;
    $("#eTitulo").textContent = p ? "Editar producto" : "Nuevo producto";
    $("#eNombre").value = p ? p.nombre : "";
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
    $("#eOrden").value = p ? p.orden : 100;
    fotosEd = p ? [p.img, ...(p.fotos || [])].filter(Boolean) : [];
    $("#eBorrar").hidden = !p;
    $("#eError").textContent = ""; $("#eSubiendo").textContent = "";
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

  // Achica la foto (máx. 1200 px) y la convierte a WebP antes de subirla
  async function achicar(file) {
    const bmp = await createImageBitmap(file);
    const r = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, "image/webp", 0.82));
  }
  $("#eSubir").addEventListener("change", async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    const carpeta = slug($("#eNombre").value) || "sin-nombre";
    for (let i = 0; i < files.length; i++) {
      $("#eSubiendo").textContent = `Subiendo ${i + 1} de ${files.length}...`;
      try {
        const blob = await achicar(files[i]);
        const ext = blob.type === "image/webp" ? "webp" : "png";
        const ruta = `${carpeta}/${Date.now()}-${i}.${ext}`;
        const { error } = await sb.storage.from("productos").upload(ruta, blob, { contentType: blob.type });
        if (error) throw error;
        fotosEd.push(sb.storage.from("productos").getPublicUrl(ruta).data.publicUrl);
        pintarFotosEd();
      } catch (err) { $("#eError").textContent = "No se pudo subir una foto: " + (err.message || err); }
    }
    $("#eSubiendo").textContent = "";
  });

  $("#fEditor").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#eError").textContent = "";
    const num = (s) => ($(s).value === "" ? null : Number($(s).value));
    const fila = {
      nombre: $("#eNombre").value.trim(), categoria: $("#eCategoria").value, precio: num("#ePrecio") || 0,
      mayor_desde: num("#eMayorDesde"), mayor_precio: num("#eMayorPrecio"), mayor_consultar: num("#eMayorConsultar"),
      descripcion: $("#eDesc").value.trim() || null, activo: $("#eActivo").checked, tendencia: $("#eTendencia").checked,
      temporada: $("#eTemporada").checked, nuevo: $("#eNuevo").checked, agotado: $("#eAgotado").checked,
      cotizar: $("#eCotizar").checked, orden: num("#eOrden") ?? 100,
      img: fotosEd[0] || null, fotos: fotosEd.slice(1), actualizado: new Date().toISOString()
    };
    if ((fila.mayor_desde && !fila.mayor_precio) || (!fila.mayor_desde && fila.mayor_precio)) {
      $("#eError").textContent = "Para precio por mayor llena las dos casillas (desde y precio), o déjalas vacías."; return;
    }
    let error;
    if (edit) ({ error } = await sb.from("productos").update(fila).eq("id", edit.id));
    else {
      let id = slug(fila.nombre) || "producto", n = 2;
      while (productos.some((p) => p.id === id)) id = `${slug(fila.nombre)}-${n++}`;
      ({ error } = await sb.from("productos").insert({ id, ...fila }));
    }
    if (error) { $("#eError").textContent = "No se pudo guardar: " + error.message; return; }
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
      k(tot.carrito, "Agregados al carrito") + k(tot.whatsapp, "💬 Clics enviar pedido") + k(tot.cotizar, "💬 Clics cotizar");

    const nombre = (id) => {
      const p = productos.find((x) => x.id === id);
      return p ? p.nombre : id === "por-mayor" ? "📦 Cotizar por mayor (general)" : id === "personalizado" ? "✨ Cotizar personalizado (general)" : id;
    };
    const filas = Object.entries(porProd).map(([id, m]) => ({ id, ...m, wsp: (m.whatsapp || 0) + (m.cotizar || 0) }))
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
