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
  pageElements: [], // ページのDOM要素キャッシュ
  renderedPages: new Set(), // レンダリング済みページ番号
};

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
    const viewport = page.getViewport({ scale: state.scale });

    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.dataset.pageNumber = String(pageNum);
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
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

// 個別ページのレンダリング
async function renderPage(pageNum) {
  if (state.renderedPages.has(pageNum)) {
    return;
  }
  state.renderedPages.add(pageNum);

  try {
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.scale });
    const pageDiv = state.pageElements[pageNum - 1];
    const canvas = pageDiv.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;

    await page.render({ canvasContext: ctx, viewport }).promise;
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

// 全ページの再レンダリング（倍率変更時など）
async function rerenderAll() {
  state.renderedPages.clear();
  for (let i = 0; i < state.pageElements.length; i++) {
    const pageNum = i + 1;
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.scale });
    const pageDiv = state.pageElements[i];
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
    const canvas = pageDiv.querySelector('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
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

  document.getElementById('btn-zoom-in').addEventListener('click', async () => {
    state.scale = Math.min(state.scale + 0.25, 3.0);
    updateZoomIndicator();
    await rerenderAll();
  });

  document.getElementById('btn-zoom-out').addEventListener('click', async () => {
    state.scale = Math.max(state.scale - 0.25, 0.5);
    updateZoomIndicator();
    await rerenderAll();
  });

  document.getElementById('btn-zoom-fit').addEventListener('click', async () => {
    const container = document.getElementById('viewer-container');
    const page = await state.pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1.0 });
    const padding = 32;
    const fitScale = (container.clientWidth - padding) / baseViewport.width;
    state.scale = Math.max(0.5, Math.min(3.0, fitScale));
    updateZoomIndicator();
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

  // マウスホイールで横スクロール（横モード時）
  document.getElementById('viewer').addEventListener('wheel', (e) => {
    const scrollMode = document.body.dataset.scroll;
    if (scrollMode === 'horizontal' && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      const viewer = document.getElementById('viewer');
      viewer.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

// 拡張機能側からの設定変更通知を受信
window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'updateSettings') {
    const s = message.payload;
    document.body.dataset.direction = s.readingDirection;
    document.body.dataset.scroll = s.scrollMode;
    document.body.dataset.spread = String(s.spread);
    if (s.defaultScale !== state.scale) {
      state.scale = s.defaultScale;
      updateZoomIndicator();
      rerenderAll();
    }
  }
});

main();
