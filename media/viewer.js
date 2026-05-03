// RTL PDF Viewer - WebView側スクリプト
// PDF.jsを使ってPDFをcanvasにレンダリングし、RTL横スクロール表示する

const config = window.__RTL_PDF_CONFIG__;
const vscode = acquireVsCodeApi();

// 状態管理
const state = {
  pdfDoc: null,
  numPages: 0,
  currentPage: 1,
  scale: config.settings.defaultScale,
  // HiDPIスーパーサンプリング倍率: ユーザー設定 × デバイス画素密度
  // 例: renderQuality=2.0, devicePixelRatio=2（Retina）→ 4倍解像度でレンダリング
  qualityMultiplier:
    (config.settings.renderQuality || 2.0) * (window.devicePixelRatio || 1),
  pageElements: [], // ページのDOM要素キャッシュ
  renderedPages: new Set(), // レンダリング済みページ番号
};

// ズーム範囲・ステップ定数
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5.0;
const ZOOM_STEP_PINCH = 0.1; // ピンチ操作1ステップ = 10%
const ZOOM_STEP_BUTTON = 0.25; // ボタン操作1ステップ = 25%
const PINCH_WHEEL_THRESHOLD = 30; // Ctrl+wheelで1ステップ進めるための累積deltaY

// state.scaleを範囲内にクランプ
function clampZoom(value) {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(value * 100) / 100));
}

// ズーム適用＋スロットルされた再レンダリング
let rerenderTimer = null;
function applyZoom(newScale) {
  const clamped = clampZoom(newScale);
  if (clamped === state.scale) {
    return false;
  }
  state.scale = clamped;
  updateZoomIndicator();
  // 連続ピンチでの過剰な再レンダリングを抑制
  if (rerenderTimer) {
    clearTimeout(rerenderTimer);
  }
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    rerenderAll();
  }, 120);
  return true;
}

// PDF.jsを動的import（CSP対応）
async function loadPdfJs() {
  const pdfjsLib = await import(config.pdfjsLib);
  pdfjsLib.GlobalWorkerOptions.workerSrc = config.pdfjsWorker;
  return pdfjsLib;
}

// メイン処理
async function main() {
  try {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({
      url: config.pdfUri,
      cMapUrl: undefined, // CMapはバンドルしていないので日本語フォントは埋め込み前提
      cMapPacked: true,
    });
    state.pdfDoc = await loadingTask.promise;
    state.numPages = state.pdfDoc.numPages;

    document.getElementById('loading').classList.add('hidden');
    await renderAllPages();
    updatePageIndicator();
    setupEventListeners();
    scrollToFirstPage();

    vscode.postMessage({ type: 'ready' });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    document.getElementById('loading').textContent = `エラー: ${message}`;
    vscode.postMessage({ type: 'error', payload: message });
  }
}

// 全ページのプレースホルダーを作成（レンダリングは遅延）
async function renderAllPages() {
  const viewer = document.getElementById('viewer');
  viewer.innerHTML = '';
  state.pageElements = [];
  state.renderedPages.clear();

  for (let pageNum = 1; pageNum <= state.numPages; pageNum++) {
    const page = await state.pdfDoc.getPage(pageNum);
    // 表示サイズはユーザー指定のscaleに基づく
    const displayViewport = page.getViewport({ scale: state.scale });

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.dataset.pageNumber = String(pageNum);
    pageDiv.style.width = `${displayViewport.width}px`;
    pageDiv.style.height = `${displayViewport.height}px`;

    // canvasは表示サイズで仮確保（実際の高解像度レンダリングはrenderPageで行う）
    const canvas = document.createElement('canvas');
    canvas.width = displayViewport.width;
    canvas.height = displayViewport.height;
    canvas.style.width = `${displayViewport.width}px`;
    canvas.style.height = `${displayViewport.height}px`;
    pageDiv.appendChild(canvas);

    viewer.appendChild(pageDiv);
    state.pageElements.push(pageDiv);
  }

  // IntersectionObserverで可視ページのみレンダリング
  setupLazyRender();
}

// 可視ページの遅延レンダリング
function setupLazyRender() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
          renderPage(pageNum);
        }
      }
      updateCurrentPageFromVisible(entries);
    },
    {
      root: document.getElementById('viewer'),
      rootMargin: '200px', // 200px先まで先読み
      threshold: 0.1,
    }
  );

  for (const el of state.pageElements) {
    observer.observe(el);
  }
}

// 個別ページのレンダリング（HiDPI対応：内部解像度 = 表示サイズ × qualityMultiplier）
async function renderPage(pageNum) {
  if (state.renderedPages.has(pageNum)) {
    return;
  }
  state.renderedPages.add(pageNum);

  try {
    const page = await state.pdfDoc.getPage(pageNum);
    // 表示サイズ（CSS px）とレンダリングサイズ（物理px）を分離
    const displayViewport = page.getViewport({ scale: state.scale });
    const renderViewport = page.getViewport({
      scale: state.scale * state.qualityMultiplier,
    });

    const pageDiv = state.pageElements[pageNum - 1];
    const canvas = pageDiv.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // canvas内部解像度は高解像度（鮮明）
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    // CSS表示サイズは標準（ユーザーが指定した倍率）
    canvas.style.width = `${displayViewport.width}px`;
    canvas.style.height = `${displayViewport.height}px`;
    pageDiv.style.width = `${displayViewport.width}px`;
    pageDiv.style.height = `${displayViewport.height}px`;

    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
  } catch (err) {
    console.error(`ページ ${pageNum} のレンダリングに失敗:`, err);
    state.renderedPages.delete(pageNum); // 再試行可能に
  }
}

// 可視ページから現在ページを判定
function updateCurrentPageFromVisible(entries) {
  const visible = entries
    .filter((e) => e.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
  if (visible.length > 0) {
    const pageNum = parseInt(visible[0].target.dataset.pageNumber, 10);
    state.currentPage = pageNum;
    updatePageIndicator();
  }
}

// ページ番号インジケータの更新
function updatePageIndicator() {
  const indicator = document.getElementById('page-indicator');
  indicator.textContent = `${state.currentPage} / ${state.numPages}`;
  document.getElementById('btn-prev').disabled = state.currentPage <= 1;
  document.getElementById('btn-next').disabled = state.currentPage >= state.numPages;
}

// 倍率インジケータの更新
function updateZoomIndicator() {
  document.getElementById('zoom-indicator').textContent = `${Math.round(state.scale * 100)}%`;
}

// 指定ページへスクロール
function goToPage(pageNum) {
  if (pageNum < 1 || pageNum > state.numPages) {
    return;
  }
  const target = state.pageElements[pageNum - 1];
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    state.currentPage = pageNum;
    updatePageIndicator();
  }
}

// 初期表示位置（RTLなら最初のページが右端）
function scrollToFirstPage() {
  const viewer = document.getElementById('viewer');
  const direction = document.body.dataset.direction;
  const scrollMode = document.body.dataset.scroll;
  if (scrollMode === 'horizontal' && direction === 'rtl') {
    // RTL横スクロールでは1ページ目が右端
    viewer.scrollLeft = 0; // RTLではscrollLeft=0が右端
  } else {
    viewer.scrollLeft = 0;
    viewer.scrollTop = 0;
  }
}

// 全ページの再レンダリング（倍率変更・画質変更時など）
async function rerenderAll() {
  state.renderedPages.clear();
  for (let i = 0; i < state.pageElements.length; i++) {
    const pageNum = i + 1;
    const page = await state.pdfDoc.getPage(pageNum);
    const displayViewport = page.getViewport({ scale: state.scale });
    const renderViewport = page.getViewport({
      scale: state.scale * state.qualityMultiplier,
    });
    const pageDiv = state.pageElements[i];
    pageDiv.style.width = `${displayViewport.width}px`;
    pageDiv.style.height = `${displayViewport.height}px`;
    const canvas = pageDiv.querySelector('canvas');
    // 内部解像度は高解像度、CSS表示は標準サイズ
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    canvas.style.width = `${displayViewport.width}px`;
    canvas.style.height = `${displayViewport.height}px`;
  }
  // 可視範囲のみ即座に再レンダリング
  setupLazyRender();
}

// ページめくり方向を考慮した「次/前」
function nextPage() {
  goToPage(state.currentPage + 1);
}

function prevPage() {
  goToPage(state.currentPage - 1);
}

// イベントリスナー
function setupEventListeners() {
  document.getElementById('btn-prev').addEventListener('click', prevPage);
  document.getElementById('btn-next').addEventListener('click', nextPage);

  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    applyZoom(state.scale + ZOOM_STEP_BUTTON);
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    applyZoom(state.scale - ZOOM_STEP_BUTTON);
  });

  document.getElementById('btn-zoom-fit').addEventListener('click', async () => {
    const container = document.getElementById('viewer-container');
    const page = await state.pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const padding = 32;
    const fitScale = (container.clientWidth - padding) / baseViewport.width;
    applyZoom(fitScale);
  });

  // 画質切替ボタン（1x → 2x → 3x → 4x → 1x の循環）
  document.getElementById('btn-quality').addEventListener('click', async () => {
    const dpr = window.devicePixelRatio || 1;
    const userQuality = state.qualityMultiplier / dpr;
    // 1x → 2x → 3x → 4x → 1x の循環
    const next = userQuality >= 4.0 ? 1.0 : Math.round(userQuality + 1);
    state.qualityMultiplier = next * dpr;
    updateQualityIndicator();
    await rerenderAll();
  });

  document.getElementById('btn-toggle-direction').addEventListener('click', () => {
    const current = document.body.dataset.direction;
    document.body.dataset.direction = current === 'rtl' ? 'ltr' : 'rtl';
    scrollToFirstPage();
  });

  document.getElementById('btn-toggle-scroll').addEventListener('click', () => {
    const current = document.body.dataset.scroll;
    document.body.dataset.scroll = current === 'horizontal' ? 'vertical' : 'horizontal';
    goToPage(state.currentPage);
  });

  document.getElementById('btn-toggle-spread').addEventListener('click', () => {
    const current = document.body.dataset.spread === 'true';
    document.body.dataset.spread = String(!current);
  });

  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    const direction = document.body.dataset.direction;
    const scrollMode = document.body.dataset.scroll;

    // RTL横スクロール時はキーの意味を反転
    const isRtlHorizontal = scrollMode === 'horizontal' && direction === 'rtl';

    switch (e.key) {
      case 'ArrowRight':
        if (isRtlHorizontal) {
          prevPage();
        } else {
          nextPage();
        }
        e.preventDefault();
        break;
      case 'ArrowLeft':
        if (isRtlHorizontal) {
          nextPage();
        } else {
          prevPage();
        }
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        nextPage();
        e.preventDefault();
        break;
      case 'ArrowUp':
      case 'PageUp':
        prevPage();
        e.preventDefault();
        break;
      case 'Home':
        goToPage(1);
        e.preventDefault();
        break;
      case 'End':
        goToPage(state.numPages);
        e.preventDefault();
        break;
    }
  });

  // マウスホイール: Ctrl押下時はピンチズーム、それ以外は横スクロール（横モード時）
  let pinchAccumulator = 0;
  document.getElementById('viewer').addEventListener('wheel', (e) => {
    // トラックパッドのピンチ操作は ctrlKey + wheel として届く
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      pinchAccumulator += e.deltaY;
      // 閾値を超えるたびに10%ステップで変更
      while (Math.abs(pinchAccumulator) >= PINCH_WHEEL_THRESHOLD) {
        const direction = pinchAccumulator > 0 ? -1 : 1; // ホイール上=拡大
        applyZoom(state.scale + ZOOM_STEP_PINCH * direction);
        pinchAccumulator -= PINCH_WHEEL_THRESHOLD * (pinchAccumulator > 0 ? 1 : -1);
      }
      return;
    }

    const scrollMode = document.body.dataset.scroll;
    if (scrollMode === 'horizontal' && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      const viewer = document.getElementById('viewer');
      viewer.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  // タッチスクリーンでの2本指ピンチズーム
  let pinchInitialDistance = null;
  let pinchInitialScale = null;
  let pinchLastQuantizedScale = null;
  const viewerEl = document.getElementById('viewer');

  viewerEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchInitialDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchInitialScale = state.scale;
      pinchLastQuantizedScale = state.scale;
    }
  }, { passive: true });

  viewerEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchInitialDistance !== null) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDistance / pinchInitialDistance;
      const targetScale = pinchInitialScale * ratio;
      // 10%刻みに量子化
      const quantized = Math.round(targetScale * 10) / 10;
      if (quantized !== pinchLastQuantizedScale) {
        pinchLastQuantizedScale = quantized;
        applyZoom(quantized);
      }
    }
  }, { passive: false });

  const resetPinch = () => {
    pinchInitialDistance = null;
    pinchInitialScale = null;
    pinchLastQuantizedScale = null;
  };
  viewerEl.addEventListener('touchend', resetPinch);
  viewerEl.addEventListener('touchcancel', resetPinch);
}

// 拡張機能側からの設定変更通知を受信
window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'updateSettings') {
    const s = message.payload;
    document.body.dataset.direction = s.readingDirection;
    document.body.dataset.scroll = s.scrollMode;
    document.body.dataset.spread = String(s.spread);

    // 画質設定の変更を反映（DPRと掛け合わせて実際の倍率に変換）
    const newQuality =
      (s.renderQuality || 2.0) * (window.devicePixelRatio || 1);
    const qualityChanged = newQuality !== state.qualityMultiplier;
    state.qualityMultiplier = newQuality;

    if (s.defaultScale !== state.scale || qualityChanged) {
      state.scale = s.defaultScale;
      updateZoomIndicator();
      updateQualityIndicator();
      rerenderAll();
    }
  }
});

// 画質インジケータ更新（ツールバーに表示）
function updateQualityIndicator() {
  const indicator = document.getElementById('quality-indicator');
  if (indicator) {
    const userQuality = state.qualityMultiplier / (window.devicePixelRatio || 1);
    indicator.textContent = `画質 ${userQuality.toFixed(1)}x`;
  }
}

main();
