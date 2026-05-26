# 海洋マッピング単一HTMLアプリ リファクタリング方針・実装指示書

## 1. 目的

既存の単一HTML版アプリケーションを、開発しやすいモダンWeb構成へリファクタリングする。

ただし、最終成果物はこれまでと同じく、**CSS / JavaScript / HTML が 1 ファイルに統合された `index.html`** とし、ブラウザで直接開いて動作することを必須条件とする。

## 2. 最終成果物

最終的に以下を生成すること。

```text
/dist/index.html
```

この `index.html` は以下の条件を満たすこと。

- CSS、JavaScript、HTML が 1 ファイルに統合されている
- CDN や外部URLに依存しない
- Webサーバーなしでローカルブラウザから開いて動作する
- CSV保存・読込が動作する
- ポイント計算・履歴表示・マッピング表示が動作する

## 3. 採用技術

以下の構成を採用する。

| 項目 | 技術 |
|---|---|
| フレームワーク | Vue 3 |
| 言語 | TypeScript |
| ビルドツール | Vite |
| 単一HTML化 | vite-plugin-singlefile |
| CSS | Vue SFC の scoped CSS または通常CSS |
| マッピング描画 | SVG |
| CSV処理 | 自前実装 |

## 4. 採用しない技術

以下は原則として採用しない。

| 技術 | 理由 |
|---|---|
| Nuxt / Next.js | 今回の用途には過剰 |
| Vuetify | 単一HTML化した際にサイズが大きくなりやすい |
| Leaflet / MapLibre | 地図タイルが必要になりやすく、相対座標マップには過剰 |
| CDN依存ライブラリ | オフライン単一HTML配布の条件に反する |
| サーバーサイドAPI | ローカル単一HTMLで完結させるため |

## 5. 推奨プロジェクト構成

```text
ocean-mapper/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.ts
    ├── App.vue
    ├── types/
    │   └── point.ts
    ├── utils/
    │   ├── coordinate.ts
    │   └── csv.ts
    ├── components/
    │   ├── PointForm.vue
    │   ├── PointTable.vue
    │   └── MapCanvas.vue
    └── styles/
        └── main.css
```

## 6. セットアップ手順

新規構成に移行する場合は以下で作成する。

```bash
npm create vite@latest ocean-mapper -- --template vue-ts
cd ocean-mapper
npm install
npm install -D vite-plugin-singlefile
```

開発時は以下で起動する。

```bash
npm run dev
```

配布用ビルドは以下で行う。

```bash
npm run build
```

## 7. Vite設定

`vite.config.ts` は以下を基本とする。

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    vue(),
    viteSingleFile(),
  ],
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
```

## 8. アプリケーション要件

### 8.1 座標計算

基準点を `(0, 0)` とする。

入力項目は以下。

- ポイント名称
- 距離 `distance`
- 深度 `depth`
- 方角 `bearingDeg`
- 色 `color`
- アイコン `icon`

方角は、北を `0°` とし、時計回りに `0〜360°` とする。

計算式は以下。

```ts
const rad = bearingDeg * Math.PI / 180
const x = distance * Math.sin(rad)
const y = distance * Math.cos(rad)
const z = -depth
```

座標軸は以下の扱いにする。

```text
x: 東方向を正、西方向を負
y: 北方向を正、南方向を負
z: 海抜0mを基準とし、水深は負の値
```

例：

```text
距離1400m、方角275°の場合、おおむね西方向に大きく移動するため x は負になる。
```

### 8.2 ポイント管理

以下の操作を実装する。

- ポイント追加
- ポイント一覧表示
- ポイント削除
- 全ポイント削除
- 必要に応じてポイント編集

各ポイントは以下の型を基本とする。

```ts
export type MapPoint = {
  id: string
  name: string
  distance: number
  depth: number
  bearingDeg: number
  x: number
  y: number
  z: number
  color: string
  icon: string
  createdAt: string
}
```

### 8.3 マッピング表示

マッピングは SVG で実装する。

必須表示要素は以下。

- 基準点 `(0, 0)`
- 各ポイント
- ポイント名ラベル
- X/Y軸
- スケール目盛り
- 凡例または簡易説明

推奨仕様：

- 全ポイントが画面内に収まるように自動スケーリングする
- 基準点は常に分かりやすく表示する
- 色はユーザー指定の `color` を反映する
- アイコンは絵文字または短い記号として扱う
- 深度はラベルまたはツールチップ的な表示で確認できるようにする

### 8.4 CSV保存

現在のポイント履歴を CSV としてダウンロードできること。

推奨CSV列：

```csv
id,name,distance,depth,bearingDeg,x,y,z,color,icon,createdAt
```

CSV出力時の注意：

- カンマ、改行、ダブルクォートを含む値を正しくエスケープする
- 文字コードは UTF-8 とする
- ファイル名は例として `ocean-mapping-points.csv` とする

### 8.5 CSV読込

CSVファイルを読み込み、ポイント履歴として復元できること。

CSV読込時の注意：

- ヘッダー行を解釈する
- 数値項目は `number` に変換する
- 不正な行は可能ならスキップし、件数をユーザーに通知する
- `x`, `y`, `z` が欠けている場合は `distance`, `depth`, `bearingDeg` から再計算する
- 読み込んだデータは既存履歴に追加するか、置換するかをUIで選択できると望ましい

## 9. コンポーネント設計

### 9.1 `App.vue`

役割：

- アプリ全体の状態管理
- 各コンポーネントの接続
- CSV保存・読込処理の呼び出し

保持する主な状態：

```ts
const points = ref<MapPoint[]>([])
```

### 9.2 `PointForm.vue`

役割：

- 入力フォーム
- 座標計算
- ポイント追加イベントの発火

入力バリデーション：

- 距離は `0` 以上
- 深度は `0` 以上
- 方角は `0〜360` の範囲
- 名前が空の場合は自動名を付与してもよい

### 9.3 `PointTable.vue`

役割：

- 登録済みポイントの一覧表示
- 削除ボタン
- 座標値の表示

表示項目：

- 名称
- 距離
- 深度
- 方角
- x
- y
- z
- 色
- アイコン
- 作成日時

### 9.4 `MapCanvas.vue`

役割：

- SVGによるマッピング表示
- 基準点、各ポイント、軸、ラベルの描画

props：

```ts
const props = defineProps<{
  points: MapPoint[]
}>()
```

## 10. ユーティリティ設計

### 10.1 `utils/coordinate.ts`

座標計算関数を分離する。

```ts
export function calculateCoordinate(distance: number, depth: number, bearingDeg: number) {
  const rad = bearingDeg * Math.PI / 180

  return {
    x: distance * Math.sin(rad),
    y: distance * Math.cos(rad),
    z: -depth,
  }
}
```

### 10.2 `utils/csv.ts`

CSV処理を分離する。

必要な関数：

```ts
export function exportPointsToCsv(points: MapPoint[]): string
export function parsePointsCsv(csvText: string): MapPoint[]
```

CSVパーサーは最低限以下に対応すること。

- ダブルクォートで囲まれた値
- 値中のカンマ
- 値中のダブルクォートのエスケープ
- 改行コード `LF` / `CRLF`

## 11. UI/UX方針

見た目はシンプルでよいが、実用上見やすいことを優先する。

推奨レイアウト：

```text
+------------------------------------------------+
| アプリタイトル                                 |
+----------------------+-------------------------+
| 入力フォーム          | マッピング表示          |
|                      |                         |
+----------------------+-------------------------+
| ポイント履歴テーブル                           |
+------------------------------------------------+
| CSV保存 / CSV読込 / 全削除                     |
+------------------------------------------------+
```

スタイル方針：

- 背景は薄いグレー系
- 入力フォームはカード状にする
- ボタンは主要操作と危険操作で見た目を分ける
- テーブルは横スクロールに対応する
- スマートフォン幅では縦並びにする

## 12. リファクタリング手順

別AIは以下の順番で作業すること。

### Step 1: 既存仕様の抽出

既存単一HTMLから以下を抽出する。

- 入力項目
- 座標計算ロジック
- 表示項目
- CSV保存処理
- CSV読込処理
- マッピング描画処理
- CSSスタイル

### Step 2: Vite + Vue 3 + TypeScript 構成へ移行

- `src/main.ts` を作成
- `src/App.vue` を作成
- 既存HTMLの構造を Vue コンポーネントへ分割
- グローバル変数を Vue の状態管理へ移行

### Step 3: ロジック分離

以下をコンポーネントから切り出す。

- 座標計算 → `utils/coordinate.ts`
- CSV処理 → `utils/csv.ts`
- 型定義 → `types/point.ts`

### Step 4: SVGマップの整理

- 直接DOM操作ではなく Vue のテンプレートで描画する
- `points` 配列を元に `v-for` で点を描画する
- 自動スケーリング処理を `computed` で実装する

### Step 5: 単一HTMLビルド対応

- `vite-plugin-singlefile` を導入
- `npm run build` で `dist/index.html` のみで動作することを確認
- 生成物が外部JS/CSSを参照していないことを確認

## 13. 品質条件

以下を満たすこと。

### 13.1 TypeScript

- `any` を安易に使わない
- `MapPoint` 型を中心にデータ構造を明確化する
- CSV読込など外部入力部分は型変換・検証を行う

### 13.2 ブラウザ互換

対象ブラウザ：

- 最新版 Chrome
- 最新版 Edge
- 最新版 Firefox

### 13.3 オフライン動作

ビルド後の `dist/index.html` はインターネット接続なしで動作すること。

### 13.4 データ保全

- CSV保存前にデータ欠落がないこと
- CSV読込後に座標が正しく復元されること
- 不正CSVでアプリがクラッシュしないこと

## 14. 受け入れテスト

以下をすべて確認すること。

### 14.1 計算テスト

| 距離 | 深度 | 方角 | 期待される傾向 |
|---:|---:|---:|---|
| 100 | 10 | 0 | x=0, y=100, z=-10 |
| 100 | 10 | 90 | x=100, y=0, z=-10 |
| 100 | 10 | 180 | x=0, y=-100, z=-10 |
| 100 | 10 | 270 | x=-100, y=0, z=-10 |
| 1400 | 178 | 275 | xは大きく負、yは小さく正、z=-178 |

浮動小数点誤差は許容すること。

### 14.2 UIテスト

- ポイントを追加できる
- ポイント名、色、アイコンが反映される
- ポイント一覧に計算結果が表示される
- ポイントを削除できる
- 全削除できる

### 14.3 マップテスト

- 基準点が表示される
- 追加したポイントが表示される
- ポイント名が表示される
- 複数ポイントが画面内に収まる
- 色とアイコンが反映される

### 14.4 CSVテスト

- CSVを保存できる
- 保存したCSVを読み込める
- 読み込んだポイントが一覧とマップに反映される
- 日本語のポイント名が文字化けしない
- カンマを含むポイント名でも壊れない

### 14.5 単一HTMLテスト

- `npm run build` が成功する
- `dist/index.html` 単体で開ける
- 外部JSファイルやCSSファイルに依存していない
- オフライン状態で動作する

## 15. 実装時の注意

- 既存アプリの機能を削らないこと
- 単一HTML配布という最終要件を最優先すること
- UIライブラリを安易に追加しないこと
- 直接DOM操作より Vue のリアクティブな実装を優先すること
- CSV読込などユーザー入力由来の処理は例外処理を入れること
- 計算ロジックはテストしやすいように関数として分離すること
- マップ描画は地図タイルではなく、基準点からの相対座標図として実装すること

## 16. 別AIへの作業依頼文

以下の内容でリファクタリングを実施してください。

```text
既存の海洋マッピング単一HTMLアプリを、Vue 3 + TypeScript + Vite 構成にリファクタリングしてください。

開発中はコンポーネント分割されたモダンWebアプリとして扱えるようにし、最終的には vite-plugin-singlefile を使って CSS / JavaScript / HTML が統合された単一の dist/index.html を生成してください。

必須機能は以下です。

1. 基準点を (0, 0) とした座標計算
2. 距離、深度、方角から x, y, z を計算
3. ポイント名称、色、アイコンの指定
4. 計算したポイントの履歴表示
5. SVGによるマッピング表示
6. CSV保存
7. CSV読込
8. ビルド後の dist/index.html 単体動作

技術選定は以下に固定してください。

- Vue 3
- TypeScript
- Vite
- vite-plugin-singlefile
- SVG描画
- 外部CDNなし
- サーバーサイドAPIなし

既存機能を削らず、座標計算・CSV処理・型定義・UIコンポーネントを整理してください。
最終的に npm run build で生成された dist/index.html をブラウザで直接開き、オフラインでも動作する状態にしてください。
```
