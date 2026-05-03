# Publishing Guide

VS Code Marketplace への公開手順とリリース運用ガイド。

## 一度きりのセットアップ（初回のみ）

### Step 1: Azure DevOps 組織の作成

1. https://dev.azure.com/ にアクセス
2. Microsoft アカウント（GitHub と同じメールでも別でもOK）でサインイン
3. 「New organization」をクリックして組織を作成
   - 組織名: **`StockCompass`**
   - リージョンは「Japan」推奨

### Step 2: Personal Access Token (PAT) を発行

1. Azure DevOps の右上ユーザーアイコン → **「Personal access tokens」**
2. **「+ New Token」** をクリック
3. 以下のように設定:

   | 項目 | 値 |
   |------|---|
   | Name | `vsce-publish` |
   | Organization | **「All accessible organizations」** ⚠️重要 |
   | Expiration | 1 year（最大） |
   | Scopes | **「Custom defined」** を選択 → **「Marketplace」** → **「Manage」** にチェック |

4. **「Create」** → 表示されたトークンを**必ずコピーして保存**（再表示不可）

### Step 3: Publisher の登録

1. https://marketplace.visualstudio.com/manage にアクセス
2. PAT を発行した同じ Microsoft アカウントでログイン
3. **「Create publisher」** をクリック
4. 以下を入力:

   | 項目 | 値 |
   |------|---|
   | ID | `cosara` ⚠️ package.json の `"publisher"` と完全一致させる必要あり |
   | Name | **`StockCompass`**（Marketplace上に表示される組織/発行者名） |
   | Email | cosara857@gmail.com |

5. 規約に同意して作成

> ⚠️ **`cosara` が既に他の人に取られていた場合**: package.json の `"publisher"` を別の名前（例: `cosara-dev`）に変更し、その名前で Publisher を登録してください。

### Step 4: GitHub Actions に PAT をシークレット登録

1. GitHub のリポジトリページへ: https://github.com/cosara22/rtl-pdf-viewer
2. **Settings** → **Secrets and variables** → **Actions**
3. **「New repository secret」** をクリック
4. 以下を入力:
   - Name: `VSCE_PAT`
   - Secret: Step 2 でコピーした PAT を貼り付け
5. **「Add secret」**

これでセットアップ完了。

---

## リリース運用（毎回の手順）

### A. 新バージョンを公開する

```powershell
# 1. バージョン更新（patch / minor / major のいずれか）
npm version patch    # 0.0.1 → 0.0.2
# npm version minor  # 0.0.1 → 0.1.0
# npm version major  # 0.0.1 → 1.0.0

# 2. タグと共に push
git push origin main --follow-tags
```

`npm version` は package.json の version を更新し、コミットとタグ（`v0.0.2`）を自動作成します。
タグ push をトリガーに GitHub Actions が以下を自動実行します:

1. ✅ TypeScript コンパイル
2. ✅ VSIX パッケージング
3. ✅ GitHub Release 作成（VSIX を成果物として添付）
4. ✅ VS Code Marketplace へ公開（`VSCE_PAT` 設定済みの場合のみ）

### B. ローカルから手動公開（緊急時）

```powershell
# Marketplace に手動公開
$env:VSCE_PAT = "your-pat-here"
npx vsce publish

# またはローカルのみで VSIX 生成
npm run package
```

### C. 公開済みバージョンを確認

- Marketplace: https://marketplace.visualstudio.com/items?itemName=cosara.rtl-pdf-viewer
- GitHub Releases: https://github.com/cosara22/rtl-pdf-viewer/releases

---

## バージョニング規約

[Semantic Versioning](https://semver.org/) に従う:

| 変更内容 | コマンド | 例 |
|---------|---------|---|
| バグ修正のみ | `npm version patch` | 0.1.0 → 0.1.1 |
| 機能追加（後方互換） | `npm version minor` | 0.1.0 → 0.2.0 |
| 破壊的変更 | `npm version major` | 0.1.0 → 1.0.0 |

VS Code Marketplace の慣例: `0.x.x` は preview、`1.0.0` 以降が安定版。

---

## トラブルシューティング

### ❌ `vsce publish` で `403 Forbidden`
- PAT の Scope が **Marketplace > Manage** になっているか確認
- PAT の Organization が **All accessible organizations** になっているか確認
- PAT の有効期限が切れていないか確認

### ❌ `vsce publish` で `Publisher 'xxx' not found`
- package.json の `"publisher"` と Marketplace の Publisher ID が完全一致しているか確認
- 大文字小文字も区別される

### ❌ GitHub Actions が失敗する
- Actions タブでログを確認: https://github.com/cosara22/rtl-pdf-viewer/actions
- `VSCE_PAT` シークレットが設定されているか確認
- 設定されていない場合、Marketplace公開はスキップされ、GitHub Releaseのみ作成される（仕様）

### ❌ `npm version` が「working directory not clean」エラー
- 未コミットの変更がある状態。先に `git commit` するか `git stash` する

---

## チェックリスト（Marketplace掲載前の最終確認）

- [ ] README.md の内容が最新で誤字脱字がない
- [ ] package.json の `displayName`, `description`, `keywords` が魅力的
- [ ] `categories` が適切（Visualization / Other など）
- [ ] スクリーンショットを README に追加済み（Marketplaceで表示される）
- [ ] アイコン画像（128x128 推奨）を `media/icon.png` などに配置し package.json に `"icon"` で指定
- [ ] CHANGELOG.md を作成（バージョン履歴を Marketplace に表示するため）
- [ ] LICENSE ファイルが存在
- [ ] `vsce package` がローカルで成功する
- [ ] 拡張機能が実機で正しく動作する
