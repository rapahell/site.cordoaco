/* ============================================================
   CORDOAÇO — Integração com Sanity CMS  (v5 — abrirModal hook)
   ============================================================ */

(function () {
  const PROJECT_ID = 'lr1ziyma';
  const DATASET = 'production';
  const API_VERSION = '2024-01-01';
  const API_BASE = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`;

  window.__cmsData = {
    videos: [],
    projetos: [],
    ready: false,
  };

  console.log('[CMS] v5 inicializando...');

  async function query(groq) {
    const url = `${API_BASE}?query=${encodeURIComponent(groq)}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      return json.result;
    } catch (e) {
      console.error('[CMS] Erro ao buscar:', e);
      return null;
    }
  }

  function imageUrl(ref, params = 'w=1200&q=80&auto=format') {
    if (!ref) return null;
    const m = ref.match(/^image-([a-f0-9]+)-(\d+x\d+)-(\w+)$/);
    if (!m) return null;
    const [, id, dim, ext] = m;
    return `https://cdn.sanity.io/images/${PROJECT_ID}/${DATASET}/${id}-${dim}.${ext}?${params}`;
  }

  function getInitials(nome) {
    if (!nome) return '';
    const parts = nome.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function extrairYtId(url) {
    if (!url) return null;
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // ---------- Renderizadores que leem direto de window.__cmsData ----------

  function renderVideos() {
    const el = document.getElementById('lista-videos');
    if (!el) return;
    const videos = window.__cmsData.videos;

    if (!videos.length) {
      el.innerHTML = '<div class="modal-empty">Nenhum vídeo cadastrado ainda.</div>';
      return;
    }

    el.innerHTML = videos.map(v => {
      const id = extrairYtId(v.linkYoutube);
      const thumb = id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
      return `
        <div class="modal-video-item">
          ${thumb ? `<img class="modal-video-thumb" src="${thumb}" alt="${escapeHtml(v.titulo)}" />` : ''}
          <div class="modal-video-info">
            <div class="modal-video-titulo">${escapeHtml(v.titulo)}</div>
            <a href="${escapeHtml(v.linkYoutube)}" target="_blank" rel="noopener">
              <svg data-lucide="play"></svg> Assistir no YouTube
            </a>
          </div>
        </div>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function renderProjetos() {
    const el = document.getElementById('lista-projetos');
    if (!el) return;
    const projetos = window.__cmsData.projetos;

    if (!projetos.length) {
      el.innerHTML = '<div class="modal-empty">Nenhum projeto cadastrado ainda.</div>';
      return;
    }

    el.innerHTML = projetos.map(p => `
      <a class="modal-proj-item" href="${escapeHtml(p.pdfUrl || '#')}" target="_blank" rel="noopener">
        <div class="modal-proj-icon"><svg data-lucide="file-text"></svg></div>
        <span class="modal-proj-name">${escapeHtml(p.titulo || 'Projeto')}</span>
        <div class="modal-proj-arrow"><svg data-lucide="arrow-right"></svg></div>
      </a>`).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // ---------- Hook em window.abrirModal ----------
  // O abrirModal original chama renderModalVideos/Projetos internas (closure).
  // Agente intercepta o clique pra forçar a renderização com dados do Sanity
  // DEPOIS que o abrirModal original termina.

  function instalarHookAbrirModal() {
    const original = window.abrirModal;
    if (typeof original !== 'function') {
      // ainda não foi definida pelo site, tenta de novo em 100ms
      setTimeout(instalarHookAbrirModal, 100);
      return;
    }

    window.abrirModal = function (id) {
      // chama o original (abre o modal, body overflow, etc.)
      original(id);
      // depois sobrescreve o conteúdo com nossos dados do Sanity
      if (id === 'modal-videos') renderVideos();
      if (id === 'modal-projetos') renderProjetos();
    };

    console.log('[CMS] Hook instalado em window.abrirModal');
  }

  // ---------- Carregamento principal ----------

  async function loadAll() {
    console.log('[CMS] Carregando dados do Sanity...');

    const [galeria, depoimentos, config, videos, projetos] = await Promise.all([
      query('*[_id=="galeria"][0]'),
      query('*[_type=="depoimento"] | order(ordem asc) {nome, cargoCidade, texto}'),
      query('*[_id=="configuracoes"][0]{"pdfUrl": catalogoPdf.asset->url}'),
      query('*[_type=="video"] | order(ordem asc) {titulo, linkYoutube, descricao}'),
      query('*[_type=="projeto"] | order(ordem asc) {titulo, descricao, "pdfUrl": arquivoPdf.asset->url}'),
    ]);

    console.log('[CMS] Recebido:', {
      galeria: !!galeria,
      depoimentos: depoimentos?.length || 0,
      catalogo: !!config?.pdfUrl,
      videos: videos?.length || 0,
      projetos: projetos?.length || 0,
    });

    // Galeria
    if (galeria) {
      for (let i = 1; i <= 6; i++) {
        const ref = galeria[`foto${i}`]?.asset?._ref;
        const url = imageUrl(ref, 'w=800&h=800&fit=crop&q=80&auto=format');
        if (!url) continue;
        const img = document.querySelector(`[data-cms-foto="${i}"]`);
        if (img) img.src = url;
      }
    }

    // Depoimentos
    if (depoimentos && depoimentos.length) {
      const container = document.querySelector('[data-cms-depoimentos]');
      if (container) {
        const starsBlock = '<svg data-lucide="star"></svg>'.repeat(5);
        container.innerHTML = depoimentos.map(d => `
          <div class="depoimento-card" style="opacity:1; transform:none;">
            <div class="depoimento-aspas">"</div>
            <div class="depoimento-stars">${starsBlock}</div>
            <p class="depoimento-texto">${escapeHtml(d.texto)}</p>
            <div class="depoimento-autor">
              <div class="depoimento-avatar">${getInitials(d.nome)}</div>
              <div class="depoimento-info">
                <strong>${escapeHtml(d.nome)}</strong>
                <span>${escapeHtml(d.cargoCidade)}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // Catálogo
    if (config?.pdfUrl) {
      document.querySelectorAll('[data-cms-catalogo]').forEach(el => {
        el.href = config.pdfUrl;
      });
    }

    // Vídeos & Projetos
    window.__cmsData.videos = videos || [];
    window.__cmsData.projetos = projetos || [];
    window.__cmsData.ready = true;

    // Pré-renderiza os modais (caso já estejam visíveis)
    renderVideos();
    renderProjetos();

    if (typeof lucide !== 'undefined') lucide.createIcons();

    console.log('[CMS] ✓ Tudo carregado');
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    instalarHookAbrirModal();
  });
})();
