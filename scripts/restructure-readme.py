# -*- coding: utf-8 -*-
"""README の構成を利用者向けへ組み替える(一度きりの整形)。

背景:
  Marketplace の拡張ページは README.md をそのまま表示する。
  現行 README は Features の直後に「Setup: npm install → PDF.js ダウンロード →
  TypeScript コンパイル → F5 → VSIX 作成」という開発者向け手順が並んでおり、
  Marketplace から入れた利用者には「入れた後にビルドが要る」と読める。

  実際には公開中の v0.0.4 VSIX に PDF.js が同梱されている(実測: extension/media/pdfjs/
  pdf.min.mjs 336,222 B / pdf.worker.min.mjs 1,366,356 B)。追加のセットアップは不要。

やること:
  - Setup 節を切り出して末尾へ移し、見出しを Development / 開発 に変える
  - 空いた位置に Installation / インストール 節を入れる
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INSTALL_EN = """## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cosara.rtl-pdf-viewer), or open the Extensions view (`Ctrl+Shift+X`) and search for **RTL PDF Viewer**.

That is all. PDF.js ships inside the extension, so there is nothing to download, build, or configure. Open any PDF, pick **RTL PDF Viewer** from the editor selector, and you are reading.

> Building from source instead? See [Development](#development).

"""

INSTALL_JA = """## インストール

[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cosara.rtl-pdf-viewer) から入れるか、拡張機能ビュー（`Ctrl+Shift+X`）で **RTL PDF Viewer** を検索してください。

これだけです。PDF.js は拡張に同梱しているので、ダウンロードもビルドも設定も要りません。PDF を開いてエディタの選択肢から **RTL PDF Viewer** を選べば読み始められます。

> ソースからビルドする場合は [開発](#開発) を参照してください。

"""


def move_section(text, start_head, end_head, new_head, insert_before, install_block):
    """start_head 節を切り出し、new_head に改名して insert_before の直前へ移す。
    切り出した位置には install_block を差し込む。"""
    si = text.index(start_head)
    ei = text.index(end_head, si)
    section = text[si:ei]
    rest = text[:si] + install_block + text[ei:]

    # 見出しを差し替える(節の先頭行だけ)
    section = section.replace(start_head, new_head, 1)

    ii = rest.index(insert_before)
    return rest[:ii] + section + rest[ii:]


def fix_stale_version(text):
    """開発手順に残っている古いファイル名を現行バージョンに合わせない形へ直す。"""
    text = text.replace('rtl-pdf-viewer-0.0.1.vsix', 'rtl-pdf-viewer-<version>.vsix')
    text = text.replace('Generates `rtl-pdf-viewer-<version>.vsix`.',
                        'Generates `rtl-pdf-viewer-<version>.vsix` in the repository root.')
    text = text.replace('`rtl-pdf-viewer-<version>.vsix` が生成されます。',
                        'リポジトリ直下に `rtl-pdf-viewer-<version>.vsix` が生成されます。')
    return text


def main():
    # --- 英語版 ---
    p = os.path.join(ROOT, 'README.md')
    t = io.open(p, encoding='utf-8').read()
    t = move_section(t, '## Setup\n', '## Usage\n', '## Development\n',
                     '## Contributing\n', INSTALL_EN)
    t = fix_stale_version(t)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(t)
    print('更新: README.md')

    # --- 日本語版 ---
    p = os.path.join(ROOT, 'README.ja.md')
    t = io.open(p, encoding='utf-8').read()
    t = move_section(t, '## セットアップ手順\n', '## 使い方\n', '## 開発\n',
                     '## ライセンス\n', INSTALL_JA)
    t = fix_stale_version(t)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(t)
    print('更新: README.ja.md')


if __name__ == '__main__':
    main()
