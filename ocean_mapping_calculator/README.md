# 海洋マッピング座標計算ツール（Vue 3 + TypeScript + Vite 版）

## 概要

既存の単一HTMLアプリケーションを Vue 3 + TypeScript + Vite 構成にリファクタリングしたバージョンです。  
開発時はコンポーネント分割されたモダンWebアプリとして扱い、最終的に `vite-plugin-singlefile` で CSS/JavaScript/HTML が統合された単一 `dist/index.html` を生成します。

## 前提条件

- **Node.js** 18以上
- **npm** 9以上

## セットアップ

```bash
cd ocean_mapping_calculator/ocean-mapper
npm install
```

## 開発

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## ビルド（単一HTML生成）

```bash
npm run build
```

生成物: `dist/index.html`

- CSS、JavaScript、HTML が1ファイルに統合
- CDN や外部URLに依存しない
- Webサーバーなしでローカルブラウザから開いて動作する

## プレビュー

```bash
npm run preview
```

ビルド済みの `dist/index.html` をローカルサーバーでプレビューします。

## プロジェクト構成

```
ocean-mapper/
├── index.html              # Vite エントリHTML
├── package.json
├── vite.config.ts          # Vite + singlefile 設定
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── env.d.ts
└── src/
    ├── main.ts             # エントリポイント
    ├── App.vue             # ルートコンポーネント（状態管理）
    ├── types/
    │   └── point.ts        # MapPoint 型・定数
    ├── utils/
    │   ├── coordinate.ts   # 座標計算・ユーティリティ
    │   └── csv.ts          # CSV入出力
    ├── components/
    │   ├── PointForm.vue   # 入力フォーム・計算結果
    │   ├── PointTable.vue  # 履歴テーブル・CSV操作
    │   └── MapCanvas.vue   # SVGマッピング（パン・ズーム）
    └── styles/
        └── main.css        # グローバルスタイル
```

## 実装済み機能

元の単一HTML版の全機能を維持しています。

- 基準点を (0,0,0) とした座標計算
- 距離・深度・方角から x, y, z を計算
- 斜距離 / 水平距離 切り替え
- 方角の意味（toBase / fromBase）切り替え
- ポイント名称・アイコン（絵文字24種）指定
- 自動カラーパレット割り当て（10色）
- 計算式・コンパス表示
- SVGマッピング（パン・ズーム・グリッド3段階）
- リアルタイムプレビュー（点線表示）
- 計算履歴テーブル（個別削除・全削除）
- 結果コピー
- CSV保存（UTF-8 BOM付き）
- CSV読み込み

## 技術スタック

| 項目 | 技術 |
|---|---|
| フレームワーク | Vue 3 |
| 言語 | TypeScript |
| ビルドツール | Vite |
| 単一HTML化 | vite-plugin-singlefile |
| CSS | グローバルCSS + scoped CSS |
| マッピング描画 | SVG |
| CSV処理 | 自前実装 |