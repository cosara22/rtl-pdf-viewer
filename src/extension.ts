import * as vscode from 'vscode';
import * as path from 'path';

// 拡張機能のエントリポイント
export function activate(context: vscode.ExtensionContext): void {
  const provider = new RtlPdfEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'rtlPdfViewer.viewer',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // ページめくり方向の切り替えコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('rtlPdfViewer.toggleDirection', async () => {
      const config = vscode.workspace.getConfiguration('rtlPdfViewer');
      const current = config.get<string>('readingDirection', 'rtl');
      const next = current === 'rtl' ? 'ltr' : 'rtl';
      await config.update('readingDirection', next, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `ページめくり方向を「${next === 'rtl' ? '右→左' : '左→右'}」に変更しました`
      );
    })
  );

  // スクロール方向の切り替えコマンド
  context.subscriptions.push(
    vscode.commands.registerCommand('rtlPdfViewer.toggleScrollMode', async () => {
      const config = vscode.workspace.getConfiguration('rtlPdfViewer');
      const current = config.get<string>('scrollMode', 'horizontal');
      const next = current === 'horizontal' ? 'vertical' : 'horizontal';
      await config.update('scrollMode', next, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `スクロール方向を「${next === 'horizontal' ? '横' : '縦'}」に変更しました`
      );
    })
  );
}

export function deactivate(): void {
  // クリーンアップ処理は不要
}

// 読み取り専用のカスタムドキュメント
class RtlPdfDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {
    // PDFファイルなのでリソース解放処理は不要
  }
}

// PDFを表示するCustomEditorProvider
class RtlPdfEditorProvider implements vscode.CustomReadonlyEditorProvider<RtlPdfDocument> {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(uri: vscode.Uri): Promise<RtlPdfDocument> {
    return new RtlPdfDocument(uri);
  }

  async resolveCustomEditor(
    document: RtlPdfDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // WebViewのリソースアクセス権限を設定
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
      ],
    };

    // 設定値を取得
    const config = vscode.workspace.getConfiguration('rtlPdfViewer');
    const settings = {
      readingDirection: config.get<string>('readingDirection', 'rtl'),
      scrollMode: config.get<string>('scrollMode', 'horizontal'),
      spread: config.get<boolean>('spread', false),
      defaultScale: config.get<number>('defaultScale', 1.5),
    };

    // PDFファイルへのWebView用URIを生成
    const pdfUri = webviewPanel.webview.asWebviewUri(document.uri);

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, pdfUri, settings);

    // WebViewからのメッセージ受信ハンドラ
    webviewPanel.webview.onDidReceiveMessage(async (message: { type: string; payload?: unknown }) => {
      switch (message.type) {
        case 'error':
          vscode.window.showErrorMessage(`PDF読み込みエラー: ${String(message.payload)}`);
          break;
        case 'ready':
          // 読み込み完了通知（必要に応じて拡張）
          break;
      }
    });

    // 設定変更時にWebViewへ通知
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('rtlPdfViewer')) {
        const newConfig = vscode.workspace.getConfiguration('rtlPdfViewer');
        webviewPanel.webview.postMessage({
          type: 'updateSettings',
          payload: {
            readingDirection: newConfig.get('readingDirection'),
            scrollMode: newConfig.get('scrollMode'),
            spread: newConfig.get('spread'),
            defaultScale: newConfig.get('defaultScale'),
          },
        });
      }
    });
    webviewPanel.onDidDispose(() => configListener.dispose());
  }

  private getHtml(
    webview: vscode.Webview,
    pdfUri: vscode.Uri,
    settings: {
      readingDirection: string;
      scrollMode: string;
      spread: boolean;
      defaultScale: number;
    }
  ): string {
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'viewer.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'viewer.js'));
    const pdfjsLibUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaRoot, 'pdfjs', 'pdf.min.mjs')
    );
    const pdfjsWorkerUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaRoot, 'pdfjs', 'pdf.worker.min.mjs')
    );

    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return /* html */ `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 img-src ${cspSource} blob: data:;
                 style-src ${cspSource} 'unsafe-inline';
                 script-src ${cspSource} 'nonce-${nonce}';
                 worker-src ${cspSource} blob:;
                 connect-src ${cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>RTL PDF Viewer</title>
</head>
<body data-direction="${settings.readingDirection}"
      data-scroll="${settings.scrollMode}"
      data-spread="${settings.spread}">
  <div id="toolbar">
    <button id="btn-prev" title="前のページ">◀ 前</button>
    <span id="page-indicator">- / -</span>
    <button id="btn-next" title="次のページ">次 ▶</button>
    <span class="separator">|</span>
    <button id="btn-zoom-out" title="縮小">−</button>
    <span id="zoom-indicator">${Math.round(settings.defaultScale * 100)}%</span>
    <button id="btn-zoom-in" title="拡大">＋</button>
    <button id="btn-zoom-fit" title="幅に合わせる">幅合わせ</button>
    <span class="separator">|</span>
    <button id="btn-toggle-direction" title="ページめくり方向">↔ 方向</button>
    <button id="btn-toggle-scroll" title="スクロール方向">⇅ スクロール</button>
    <button id="btn-toggle-spread" title="見開き表示">📖 見開き</button>
  </div>
  <div id="viewer-container">
    <div id="viewer"></div>
  </div>
  <div id="loading">PDF読み込み中...</div>

  <script type="module" nonce="${nonce}">
    window.__RTL_PDF_CONFIG__ = ${JSON.stringify({
      pdfUri: pdfUri.toString(),
      pdfjsLib: pdfjsLibUri.toString(),
      pdfjsWorker: pdfjsWorkerUri.toString(),
      settings,
    })};
  </script>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

// CSP用のnonce生成
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
