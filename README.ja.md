# RTL PDF Viewer

[English](./README.md) | **日本語**

VS Code 上で PDF を **右から左への横スクロール**（漫画・縦書き和書スタイル）で読めるカスタムエディタ拡張機能。

## 主な機能

- ✅ **右→左への横スクロール表示**（和書・漫画スタイル）
- ✅ **左→右への横スクロール表示**（洋書スタイル）
- ✅ **縦スクロール表示**（通常モード）
- ✅ ページ単位ナビゲーション（矢印キー対応）
- ✅ ズーム（拡大/縮小/幅合わせ）
- ✅ 設定で初期表示モードを変更可能
- ✅ ツールバーから即座に方向切り替え

## インストール

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cosara.rtl-pdf-viewer) から入れるか、拡張機能ビュー（`Ctrl+Shift+X`）で **RTL PDF Viewer** を検索してください。

これだけです。PDF.js は拡張に同梱しているので、ダウンロードもビルドも設定も要りません。PDF を開いてエディタの選択肢から **RTL PDF Viewer** を選べば読み始められます。

> ソースからビルドする場合は [開発](#開発) を参照してください。

## 使い方

### PDFを RTL Viewer で開く

1. PDFファイルを右クリック
2. **「アプリケーションを使って開く...」**
3. **「RTL PDF Viewer」** を選択

### ツールバー操作

| ボタン | 機能 |
|--------|------|
| ◀ 前 / 次 ▶ | ページめくり |
| − / ＋ | 縮小 / 拡大 |
| 幅合わせ | 画面幅に合わせる |
| ↔ 方向 | RTL ⇔ LTR 切替 |
| ⇅ スクロール | 横 ⇔ 縦 切替 |
| 📖 見開き | 見開き表示の ON/OFF |

### キーボードショートカット

| キー | 動作（RTL横スクロール時） |
|------|----------------------|
| `→` | 前のページ（右側にあるため） |
| `←` | 次のページ（左側にあるため） |
| `↓` / `Space` / `PageDown` | 次のページ |
| `↑` / `PageUp` | 前のページ |
| `Home` | 最初のページ |
| `End` | 最終ページ |
| マウスホイール | 横スクロール（縦回転で横移動） |

## 設定項目

`settings.json` で以下が設定可能:

```json
{
  "rtlPdfViewer.readingDirection": "rtl",     // "rtl" or "ltr"
  "rtlPdfViewer.scrollMode": "horizontal",     // "horizontal" or "vertical"
  "rtlPdfViewer.spread": false,                // 見開き表示
  "rtlPdfViewer.defaultScale": 1.5             // 0.5〜3.0
}
```

## ディレクトリ構成

```
rtl-pdf-viewer/
├── package.json              # 拡張機能マニフェスト
├── tsconfig.json
├── .vscodeignore
├── src/
│   └── extension.ts          # CustomEditorProvider実装
├── media/
│   ├── viewer.html           # （extension.ts内に埋め込み）
│   ├── viewer.css            # RTL横スクロール用CSS
│   ├── viewer.js             # PDF.js統合・操作ロジック
│   └── pdfjs/                # PDF.js本体（setup後）
├── scripts/
│   └── download-pdfjs.js     # PDF.jsダウンロードスクリプト
└── .vscode/
    ├── launch.json
    └── tasks.json
```

## 既知の制限事項（プロトタイプ）

- 検索機能は未実装
- テキスト選択は未対応（canvas描画のため）
- しおり・目次は未対応
- 大きなPDFでは初期読み込みに時間がかかる可能性あり
- 日本語埋め込みフォントの含まれていないPDFは文字化けする場合あり（CMap未バンドル）

これらは将来的な拡張ポイントです。

## トラブルシューティング

### 「RTL PDF Viewer」が選択肢に出ない
- 拡張機能が正しくインストールされているか確認: `code --list-extensions | findstr rtl-pdf`
- VS Code を再起動

### PDFが真っ白で表示されない
- 開発者ツールでエラー確認: `Ctrl+Shift+P` → 「Developer: Toggle Developer Tools」
- `npm run setup` で PDF.js が正しくダウンロードされているか確認

### コンパイルエラーが出る
- `npm install` が成功しているか確認
- `node_modules/@types/vscode` が存在するか確認

## 開発

### 1. 依存パッケージのインストール

```powershell
cd "c:\Users\zeroz\Projects\金持ち父さん貧乏父さん\rtl-pdf-viewer"
npm install
```

### 2. PDF.js の取得

```powershell
npm run setup
```

`media/pdfjs/` 配下に PDF.js v4.7.76 がダウンロードされます。

### 3. TypeScript のコンパイル

```powershell
npm run compile
```

### 4. デバッグ実行（推奨：開発時）

1. VS Code でこの `rtl-pdf-viewer` フォルダを開く
2. `F5` キーを押す → 拡張機能ホストが新しいウィンドウで起動
3. 新ウィンドウ側で PDF ファイルを開くと、エディタ選択肢に「RTL PDF Viewer」が表示される
4. 既定で開きたい場合: PDFを右クリック →「アプリケーションを使って開く」→「RTL PDF Viewer」→「.pdfファイルの既定として構成」

### 5. パッケージング（インストール用VSIX作成）

```powershell
npm run package
```

リポジトリ直下に `rtl-pdf-viewer-<version>.vsix` が生成されます。

### 6. インストール

```powershell
code --install-extension rtl-pdf-viewer-<version>.vsix
```

## ライセンス

MIT
