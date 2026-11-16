/* Lógica de la tienda. Normalmente NO necesitas editar este archivo. */
(function () {
  const $ = (s) => document.querySelector(s);
  const M = CONFIG.moneda;
  const soles = (n) => `${M} ${n.toFixed(2)}`;
  const iconoCat = (id) => (CATEGORIAS.find((c) => c.id === id) || {}).icono || "📦";
  const porId = Object.fromEntries(PRODUCTOS.map((p) => [p.id, p]));

  // ---------- Carrito (se guarda en el navegador del cliente) ----------
  let carrito = {};
  try { carrito = JSON.parse(localStorage.getItem("carrito3d") || "{}"); } catch (e) {}
  for (const id in carrito) if (!porId[id]) delete carrito[id];
  const guardar = () => { try { localStorage.setItem("carrito3d", JSON.stringify(carrito)); } catch (e) {} };

  // Precio unitario: aplica el precio por mayor si llega a la cantidad mínima
  const precioUnit = (p, cant) => (p.mayor && cant >= p.mayor.desde ? p.mayor.precio : p.precio);
  const lineas = () => Object.entries(carrito).map(([id, cant]) => {
    const p = porId[id]; const pu = precioUnit(p, cant);
    return { p, cant, pu, sub: pu * cant, esMayor: pu !== p.precio };
  });
  const total = () => lineas().reduce((a, l) => a + l.sub, 0);
  const conFactura = () => document.querySelector("#fFactura").checked;
  const igv = () => (conFactura() ? total() * CONFIG.igv : 0);
  const totalFinal = () => total() + igv();
  const cantidad = () => Object.values(carrito).reduce((a, b) => a + b, 0);

  // ---------- Render de productos ----------
  function foto(p) {
    return `<img src="${p.img}" alt="${p.nombre}" loading="lazy"
      onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'${iconoCat(p.categoria)}'}))">`;
  }
  function tarjeta(p) {
    const tags = [
      p.tendencia ? '<span class="tag hot">🔥 Tendencia</span>' : "",
      p.nuevo ? '<span class="tag new">Nuevo</span>' : "",
      p.agotado ? '<span class="tag">Agotado</span>' : ""
    ].join("");
    const nFotos = 1 + (p.fotos ? p.fotos.length : 0);
    return `<article class="card">
      <div class="foto" data-ver="${p.id}" role="button" tabindex="0" aria-label="Ver fotos de ${p.nombre}">${foto(p)}<div class="etiquetas">${tags}</div>
        ${nFotos > 1 ? `<span class="n-fotos">📷 ${nFotos}</span>` : ""}</div>
      <div class="cuerpo">
        <h3>${p.nombre}</h3>
        ${p.descripcion ? `<p class="desc">${p.descripcion}</p>` : ""}
        <div class="precio">${soles(p.precio)}</div>
        ${p.mayor ? `<div class="mayor">Por mayor: ${soles(p.mayor.precio)} desde ${p.mayor.desde} u.</div>` : ""}
        ${p.mayorConsultar ? `<div class="mayor">Precio especial por mayor desde ${p.mayorConsultar} u.</div>` : ""}
        <button class="btn btn-primary agregar" data-add="${p.id}" ${p.agotado ? "disabled" : ""}>
          ${p.agotado ? "Agotado" : "Agregar"}</button>
        ${p.cotizar ? `<button class="btn btn-ghost cotizar-prod" data-cotizar-prod="${p.id}">Cotizar tamaño o cantidad</button>` : ""}
      </div>
    </article>`;
  }

  let catActual = "todo";
  function pintarChips() {
    const lista = [{ id: "todo", nombre: "Todo", icono: "" }, ...CATEGORIAS];
    $("#chips").innerHTML = lista.map((c) =>
      `<button class="chip ${c.id === catActual ? "activo" : ""}" data-cat="${c.id}">${c.icono} ${c.nombre}</button>`).join("");
  }
  function filtrar() {
    const q = $("#buscar").value.trim().toLowerCase();
    const lista = PRODUCTOS.filter((p) => {
      const enCat = catActual === "todo" || p.categoria === catActual ||
        (catActual === "tendencia" && p.tendencia) || (catActual === "temporada" && p.temporada);
      const enBusqueda = !q || (p.nombre + " " + (p.descripcion || "") + " " + p.categoria).toLowerCase().includes(q);
      return enCat && enBusqueda;
    });
    $("#grid").innerHTML = lista.map(tarjeta).join("");
    $("#vacio").hidden = lista.length > 0;
  }
  function irACategoria(id) {
    catActual = CATEGORIAS.some((c) => c.id === id) ? id : "todo";
    pintarChips(); filtrar();
  }

  // ---------- Render del carrito ----------
  function pintarCarrito() {
    const ls = lineas();
    $("#items").innerHTML = ls.length ? ls.map((l) => `
      <div class="item">
        <div class="mini">${foto(l.p)}</div>
        <div>
          <h4>${l.p.nombre}</h4>
          <small class="${l.esMayor ? "ok" : ""}">${soles(l.pu)} c/u${l.esMayor ? " · precio por mayor ✓" : ""}</small>
          ${l.p.mayor && !l.esMayor ? `<small>Por mayor desde ${l.p.mayor.desde} u.: ${soles(l.p.mayor.precio)}</small>` : ""}
          ${l.p.mayorConsultar ? `<small class="${l.cant >= l.p.mayorConsultar ? "ok" : ""}">${l.cant >= l.p.mayorConsultar ? "✓ Aplica precio especial: lo confirmamos por WhatsApp" : `Precio especial desde ${l.p.mayorConsultar} u.`}</small>` : ""}
          <small><b>${soles(l.sub)}</b></small>
        </div>
        <div class="cant">
          <button data-menos="${l.p.id}" aria-label="Quitar uno">−</button>
          <span>${l.cant}</span>
          <button data-mas="${l.p.id}" aria-label="Agregar uno">+</button>
        </div>
      </div>`).join("")
      : '<p class="carrito-vacio">Tu carrito está vacío.<br>Agrega productos del catálogo.</p>';
    const t = total(), n = cantidad(), f = conFactura();
    $("#total").textContent = soles(t);
    $("#igv").textContent = soles(igv());
    $("#totalFact").textContent = soles(totalFinal());
    $("#filaIgv").hidden = $("#filaTotalFact").hidden = $("#facturaCampos").hidden = !f;
    $("#adelanto").textContent = soles(totalFinal() * CONFIG.adelanto);
    $("#contador").textContent = n;
    $("#barraCant").textContent = n;
    $("#barraTotal").textContent = soles(t);
    $("#barraCarrito").hidden = n === 0;
    $("#formPedido").hidden = $("#pie").hidden = n === 0;
  }

  function cambiar(id, d) {
    carrito[id] = (carrito[id] || 0) + d;
    if (carrito[id] <= 0) delete carrito[id];
    guardar(); pintarCarrito();
  }

  // ---------- Mensaje de pedido ----------
  function mensaje() {
    const ls = lineas(); const t = total();
    const det = ls.map((l) => `• ${l.cant} x ${l.p.nombre} — ${soles(l.pu)} c/u${l.esMayor ? " (por mayor)" : ""} = ${soles(l.sub)}` +
      (l.p.mayorConsultar && l.cant >= l.p.mayorConsultar ? "\n   ↳ Solicito precio especial por cantidad" : "")).join("\n");
    const nombre = $("#fNombre").value.trim(), dist = $("#fDistrito").value, notas = $("#fNotas").value.trim();
    const datos = [nombre && `Nombre: ${nombre}`, dist && `Distrito: ${dist}`, notas && `Notas: ${notas}`].filter(Boolean);
    const fact = conFactura() ? [
      `IGV 18%: ${soles(igv())}`,
      `Total con IGV: ${soles(totalFinal())}`,
      `🧾 Requiero FACTURA — RUC: ${$("#fRuc").value.trim() || "(por indicar)"} · Razón social: ${$("#fRazon").value.trim() || "(por indicar)"}`
    ] : [];
    return [
      `¡Hola ${CONFIG.marca}! 👋 Quiero hacer este pedido:`, "", det, "",
      `${conFactura() ? "Subtotal" : "Total"} productos: ${soles(t)}`,
      ...fact,
      `Adelanto 50% para separar: ${soles(totalFinal() * CONFIG.adelanto)}`,
      "Envío: a coordinar (a cuenta del cliente)",
      ...(datos.length ? ["", ...datos] : [])
    ].join("\n");
  }
  const abrirWsp = (texto) => window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(texto)}`, "_blank");

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = texto; document.body.appendChild(ta);
      ta.select(); document.execCommand("copy"); ta.remove();
    }
    aviso("Pedido copiado ✓ Pégalo en WhatsApp, Messenger o Instagram");
  }

  let tAviso;
  function aviso(txt) {
    const el = $("#toast"); el.textContent = txt; el.classList.add("ver");
    clearTimeout(tAviso); tAviso = setTimeout(() => el.classList.remove("ver"), 2400);
  }

  // ---------- Galería de fotos del producto ----------
  function verProducto(id) {
    const p = porId[id]; if (!p) return;
    const imgs = [p.img, ...(p.fotos || [])];
    $("#galeria").innerHTML = imgs.map((src, i) => `<img src="${src}" alt="${p.nombre} foto ${i + 1}">`).join("");
    $("#galeria").scrollLeft = 0;
    $("#puntos").innerHTML = imgs.length > 1 ? imgs.map((_, i) => `<button data-punto="${i}" aria-label="Foto ${i + 1}" class="${i ? "" : "activo"}"></button>`).join("") : "";
    $("#modalInfo").innerHTML = `
      <h3>${p.nombre}</h3>
      <div class="precio">${soles(p.precio)}</div>
      ${p.mayor ? `<div class="mayor">Por mayor: ${soles(p.mayor.precio)} desde ${p.mayor.desde} u.</div>` : ""}
      ${p.mayorConsultar ? `<div class="mayor">Precio especial por mayor desde ${p.mayorConsultar} u.</div>` : ""}
      ${p.descripcion ? `<p>${p.descripcion}</p>` : ""}
      <button class="btn btn-primary agregar" data-add="${p.id}" ${p.agotado ? "disabled" : ""}>${p.agotado ? "Agotado" : "Agregar al carrito"}</button>
      ${p.cotizar ? `<button class="btn btn-ghost cotizar-prod" data-cotizar-prod="${p.id}">Cotizar tamaño o cantidad</button>` : ""}`;
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function cerrarModal() { $("#modal").hidden = true; document.body.style.overflow = ""; }
  $("#galeria").addEventListener("scroll", () => {
    const g = $("#galeria"), i = Math.round(g.scrollLeft / g.clientWidth);
    document.querySelectorAll("#puntos button").forEach((b, j) => b.classList.toggle("activo", i === j));
  });
  $("#puntos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-punto]"); if (!b) return;
    const g = $("#galeria"); g.scrollTo({ left: g.clientWidth * +b.dataset.punto, behavior: "smooth" });
  });
  $("#cerrarModal").addEventListener("click", cerrarModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") cerrarModal(); });

  // ---------- Abrir / cerrar carrito ----------
  function abrir() { $("#carrito").classList.add("abierto"); $("#carrito").setAttribute("aria-hidden", "false"); $("#overlay").hidden = false; }
  function cerrar() { $("#carrito").classList.remove("abierto"); $("#carrito").setAttribute("aria-hidden", "true"); $("#overlay").hidden = true; }

  // ---------- Eventos ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add],[data-mas],[data-menos],[data-cat],[data-ir],[data-cotizar],[data-cotizar-mayor],[data-cotizar-prod],[data-ver]");
    if (!t) return;
    if (t.dataset.ver) verProducto(t.dataset.ver);
    if (t.dataset.cotizarProd) {
      const p = porId[t.dataset.cotizarProd];
      abrirWsp(`¡Hola ${CONFIG.marca}! 👋 Quiero cotizar: *${p.nombre}* (precio regular ${soles(p.precio)})\n\nTamaño que necesito: \nCantidad: ${p.mayorConsultar ? `(precio especial desde ${p.mayorConsultar} u.)` : ""}\nColores: \nFecha que lo necesito: `);
    }
    if (t.hasAttribute("data-cotizar-mayor")) {
      e.preventDefault();
      abrirWsp(`¡Hola ${CONFIG.marca}! 👋 Quiero cotizar un pedido POR MAYOR:\n\nProducto(s): \nCantidad aproximada: \nFecha que lo necesito: \n¿Requiere factura?: Sí / No`);
    }
    if (t.dataset.add) { cambiar(t.dataset.add, 1); aviso("Agregado al carrito 🛒"); }
    if (t.dataset.mas) cambiar(t.dataset.mas, 1);
    if (t.dataset.menos) cambiar(t.dataset.menos, -1);
    if (t.dataset.cat) { irACategoria(t.dataset.cat); history.replaceState(null, "", "#" + t.dataset.cat); }
    if (t.dataset.ir) irACategoria(t.dataset.ir);
    if (t.hasAttribute("data-cotizar")) { e.preventDefault(); abrirWsp(`¡Hola ${CONFIG.marca}! 👋 Quiero cotizar un producto personalizado:`); }
  });
  $("#buscar").addEventListener("input", filtrar);
  $("#fFactura").addEventListener("change", pintarCarrito);
  $("#fRuc").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); });
  $("#abrirCarrito").addEventListener("click", abrir);
  $("#barraCarrito").addEventListener("click", abrir);
  $("#cerrarCarrito").addEventListener("click", cerrar);
  $("#overlay").addEventListener("click", cerrar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { cerrar(); cerrarModal(); }
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.ver) verProducto(e.target.dataset.ver);
  });
  $("#enviarWsp").addEventListener("click", () => cantidad() && abrirWsp(mensaje()));
  $("#copiar").addEventListener("click", () => cantidad() && copiar(mensaje()));

  // ---------- Inicio ----------
  $("#fDistrito").innerHTML = `<option value="">Selecciona...</option>` +
    CONFIG.distritosEntrega.map((d) => `<option>${d}</option>`).join("") +
    `<option>Otro distrito de Lima</option><option>Provincia (envío por agencia)</option>`;
  $("#distritos").textContent = CONFIG.distritosEntrega.join(", ");
  $("#diaEntrega").textContent = CONFIG.diaEntrega.toLowerCase();
  $("#tiempo").textContent = CONFIG.tiempoFabricacion;
  $("#lnkFb").href = CONFIG.redes.facebook;
  $("#lnkIg").href = CONFIG.redes.instagram;
  $("#lnkTt").href = CONFIG.redes.tiktok;
  $("#carruselTendencia").innerHTML = PRODUCTOS.filter((p) => p.tendencia).map(tarjeta).join("");

  // Links directos a una categoría: tusitio.com/#navidad  (útil para anuncios y bots)
  const esCat = (h) => CATEGORIAS.some((c) => c.id === h);
  irACategoria(location.hash.slice(1));
  if (esCat(location.hash.slice(1))) setTimeout(() => $("#catalogo").scrollIntoView(), 50);
  window.addEventListener("hashchange", () => {
    const h = location.hash.slice(1);
    if (esCat(h)) { irACategoria(h); $("#catalogo").scrollIntoView(); }
  });
  pintarCarrito();
})();
