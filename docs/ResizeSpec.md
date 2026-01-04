# 📏 TinyPixel Studio: リサイズ機能 技術仕様書

TinyPixel Studio における「キャンバスサイズ変更（リサイズ）」機能は、単なる解像度の変更だけでなく、既存のドット絵資産をどのように維持・再配置するかを制御する高度な編集機能です。

## 1. 機能概要

ユーザーは現在のキャンバスの幅と高さを変更できます。その際、以下の2つの主要なアプローチを選択可能です。

- **Fix to Page (キャンバスサイズの変更)**: キャンバスの枠だけを広げたり狭めたりします。既存のドット絵は指定された「アンカーポイント」に基づいて再配置されます。
- **Rescale (画像の拡大縮小)**: 既存のドット絵そのものを新しいサイズに合わせて引き延ばしたり縮小したりします。ドットの整合性を保つため「最近傍補間（Nearest Neighbor）」を使用します。

## 2. コア機能の詳細

### A. アスペクト比固定 (Aspect Ratio Lock)
- **挙動**: ロックが有効な場合、幅（Width）または高さ（Height）の一方を入力すると、現在のキャンバス比率（Width ÷ Height）を維持するように、もう一方の数値が自動的に算出・更新されます。
- **実装**: 入力イベントを監視し、現在の比率を係数として計算結果を反映します。

### B. 算術演算サポート (Arithmetic Support)
- **機能**: 入力欄に数値だけでなく、簡易的な算術演算式（例: `32 * 2`, `64 + 16`, `128 / 2`）を入力できます。
- **メリット**: ユーザーは「現在の2倍のサイズにしたい」といった直感的な操作を計算機なしで行えます。
- **バリデーション**: 無効な文字列やゼロ除算は無視され、前回の有効な値またはデフォルト値（32）にフォールバックします。

### C. リサイズモード (Resize Modes)

#### 1. Fix to Page モード
- **再配置ロジック**: 3x3 のアンカーグリッド（左上、中央、右下など）を使用します。
- **アンカー制御**:
  - `Center`: 画像をキャンバスの中央に配置し、周囲を広げる/削る。
  - `Top-Left`: 左上を起点とし、右方向および下方向にキャンバスを伸縮させる。
- **アルゴリズム**: 新しいサイズの空のグリッドを生成し、オフセットを計算して旧グリッドの各ピクセルを新グリッドの対応する座標に転送します。

#### 2. Rescale モード
- **補間アルゴリズム**: 最近傍補間 (Nearest Neighbor)
  - ドット絵のシャープさを維持するため、中間色の生成（バイリニア補間など）を一切行いません。
- **座標計算**: `sourceX = Math.floor(targetX * (oldWidth / newWidth))`

## 3. ユーザーインターフェース (UI)

- **ダイアログ構造**: 
  - **上部**: 現在のサイズ表示と新規サイズ入力（算術演算対応）。
  - **中央**: アスペクト比ロックの切り替えボタン（鍵アイコン）。
  - **下部**: モード選択（Fix vs Rescale）とアンカーグリッド（Fixモード時のみ表示）。
- **フィードバック**: 
  - 入力フォーカスが外れた（Blur）際、または Enter キーが押された際に演算が実行され、正規化された数値が表示されます。

## 4. パフォーマンスと制限

- **最大サイズ**: ブラウザのメモリ負荷と操作性を考慮し、最大 **2048 x 2048 px** に制限しています。
- **Undo/Redo**: リサイズ実行はヒストリースタックに1つのアクションとして保存され、いつでも元のサイズに戻すことが可能です。

## 5. テストケース

1. `32 * 2` と入力して `64` に変換されること。
2. アスペクト比ロック状態で `32 -> 64` に変更した際、もう一方も自動で `32 -> 64` になること。
3. `Fix to Page` モードで `Bottom-Right` アンカーを選択し、サイズを大きくした際、既存の絵が右下に維持されること。
4. `Rescale` モードで 16x16 を 32x32 にした際、各ドットが正確に 2x2 のブロックに拡大されること。

---

あなたはシニア UI エンジニア兼グラフィックアプリの実装担当です。  
画像/レイアウト編集アプリに「ドキュメントサイズ変更」機能を実装してください。  
下記仕様を満たすように、設計方針 → データモデル → 座標変換アルゴリズム →UI 実装 → テスト方針の順で提案し、最後に実装手順（タスク分解）も出してください。  
可能なら TypeScript 想定で擬似コードも提示してください（フレームワークは問わないが、UI とロジックを分離する）。

# 前提

- ドキュメント（キャンバス/ページ）には複数のオブジェクトが配置される。  
   例: 画像、図形、テキスト、グループ、回転あり、拡縮あり、マスク/クリップ、ストロークなど。
- 各オブジェクトは最低限、以下の幾何情報を持つ：
  - position (x,y): ドキュメント座標系（左上原点、右下正）
  - size (w,h)
  - rotation (rad or deg) ※任意だが考慮する
  - scale (sx,sy) ※任意だが考慮する
  - anchor/pivot（オブジェクト内の基準点）※既存仕様があるなら合わせる

# 新機能：ドキュメントサイズ変更ダイアログ

ユーザーが「幅」「高さ」を変更し、適用したときの挙動を指定できる。

## UI 要素

1. サイズ入力

- width, height（単位 px。必要なら mm 等は後回し）
- 変更前サイズ (oldW, oldH) と 変更後サイズ (newW, newH)

1. オブジェクトの動作（ラジオ）

- 「再スケール」(RESCALE_OBJECTS)
- 「ページに固定」(FIX_TO_PAGE)

1. アンカー（3x3 グリッド）

- 9 個（左上/上/右上/左/中央/右/左下/下/右下）
- このアンカーは “ドキュメントサイズ変更の基準点（どこを固定してキャンバスが伸び縮みするか）” を意味する。
- ラジオが「ページに固定」のとき必須（再スケールでも使うなら使って OK。仕様は下記に従う）

## 挙動の定義

### A. 「ページに固定」（FIX_TO_PAGE）

- オブジェクト自体のサイズ（w,h）や scale は変更しない。
- ただし、ドキュメント座標系の原点や有効領域がアンカー基準で変化するため、オブジェクトの座標を“見た目上その場所に留める”かどうかを明確にする必要がある。
- 本仕様では「アンカー基準でキャンバスの増減が起きる」= アンカー点はドキュメント上で不動とみなし、それに合わせて座標系がシフトする。
- よって、オブジェクト座標は以下のオフセットで一括補正する（見た目の相対位置を維持するため）：
  - Δx, Δy は「old→new のアンカー点の移動量」
  - object.x += Δx
  - object.y += Δy
- これによりアンカー点側は固定され、反対側に余白が増える/減る。

アンカーから Δ を求めるルール：

- ドキュメント座標でアンカー点を定義：
  - left = 0, center = W/2, right = W
  - top = 0, middle = H/2, bottom = H
- oldAnchor = (ax(oldW), ay(oldH))
- newAnchor = (ax(newW), ay(newH))
- Δ = newAnchor - oldAnchor
- 注意：原点は左上固定とし、座標系を“シフト補正する”ことで見た目を合わせる。

### B. 「再スケール」（RESCALE_OBJECTS）

- ドキュメントサイズの変更比率に合わせて、オブジェクトの位置とサイズを拡大縮小する。
- 基本スケール：
  - sx = newW / oldW
  - sy = newH / oldH
- アンカー基準で「アンカー点を固定しながらスケール」する。
- 位置変換（回転を一旦無視しても最低限成立するように）：
  - objectPos はドキュメント座標
  - anchorPoint oldA, newA は上と同様
  - object.x = newA.x + (object.x - oldA.x) \* sx
  - object.y = newA.y + (object.y - oldA.y) \* sy
- サイズ変換：
  - object.w \*= sx
  - object.h \*= sy
- 回転や stroke 等の扱い：
  - rotation は維持（角度は変えない）
  - stroke 幅をスケールするかは方針を決める（多くのデザインツールは設定可能）
  - まずは stroke も平均倍率 s = (sx+sy)/2 でスケール、またはスケールしない、のどちらかを明記して実装する（推奨：設定フラグだが MVP は平均倍率でスケール）

## クリッピング/はみ出しの扱い

- ドキュメントが小さくなりオブジェクトが外側にはみ出す場合でも、原則は削除しない（単に見切れる）。
- ただし「エクスポート/レンダリング」は新ドキュメント範囲でクリップされる。

## Undo/Redo

- サイズ変更は 1 つの履歴（トランザクション）として扱う。
- 変更対象：document.width/height と、必要なら全オブジェクトの幾何情報。

## パフォーマンス

- オブジェクト数が多い場合に備え、変換はループ 1 回で完結すること。
- レイアウト再計算やテキストの再フローが重い場合、バッチ更新（commit）を設ける。

# 実装要求（アウトプット）

1. データ構造（Anchor enum、ResizeMode enum、ResizeParams 等）の提案
2. 変換関数の設計

   - computeAnchorPoint(W,H,anchor)
   - resizeDocument(params, objects, document) -> {document, objects}

3. UI（ダイアログ）の状態管理とバリデーション

   - width/height は>0
   - 比率保持（オプション）を入れるならその仕様も提示

4. テストケース（最低 10 個）

   - 9 アンカーそれぞれの FIX 挙動（代表で数個でも良いが方針明示）
   - RESCALE で座標/サイズが期待値になる
   - oldW or oldH が 0 のときのガード
   - 大量オブジェクトの性能観点

5. 受け入れ基準（Acceptance Criteria）

   - FIX: アンカー点に置いたオブジェクトがサイズ変更後も同じ見た目位置に残る
   - RESCALE: アンカー点からの相対距離が倍率通りに変換される
   - Undo で完全に戻る

# 注意

- 既存の座標系（中心原点/左上原点）やオブジェクト pivot 仕様があるなら、それに合わせて式を調整すること。
- 不明点があれば「仮定」を明記した上で進め、最小実装(MVP)→ 拡張案の順に提案して。

まずは MVP を確実に実装できる内容で回答してください。

![CleanShot 2026-01-04 at 15.03.51@2x.png](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoQAAAC8CAYAAADhAb+mAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJF9kE1LAlEUhh/LMEohol0FrqKFSZhFWzOwyMVkBhUtGsdJAz9u14kQ+hHto10/Ily1a9MuKIJ+QdtAgpLpjFbaBx04nIf3vvdweKFv0FSq5AfKFUdnUkvhre2dcOAJH35CxBg3rZpKGEZaLHzO79W8E7fU7Yy36/f7vzWUt2uWzDfpqKW0A76IsHHsKI9PhMe0HCV86nGhwxce5zp82fZkM0nhG+ERq2jmhR+FI7kevdDD5dKR9XGDd33QrmxuyByVniBNijArLJORGWdN8vnbH2/7k1RR1NEcUKCII78SoihK2MKrVLCIEhGOMSu94OX8M7+uVr+HxXWB3a6WfYCGAcNnXW16CkJ7cD2vTG1+pepr+mv7c7EOBzUMvLju8yQEGtDSrvt67rotybBfdl4dvgMdjloIbTvv3QAAAIplWElmTU0AKgAAAAgABAEaAAUAAAABAAAAPgEbAAUAAAABAAAARgEoAAMAAAABAAIAAIdpAAQAAAABAAAATgAAAAAAAACQAAAAAQAAAJAAAAABAAOShgAHAAAAEgAAAHigAgAEAAAAAQAAAoSgAwAEAAAAAQAAALwAAAAAQVNDSUkAAABTY3JlZW5zaG90vsNW4QAAMW5JREFUeAHtnQeYJEXZx/s4ckYywgeSczgQBBVOBERQVAQFQUAx63PmnNDHnMWECcWAooASJOcgIFlQgghHPECOnOHg219/vvvV9vXMzszOdPfu/t7n2Z2Znu6q6l9VV/3rrTBTpk2b9mymSUACtROYf/75s6lTp2bzzDNP7WkxARKQgAQk0FwCzzzzTDZnzpzsySef7Fsi5+1bSAYkAQmMiUA/H+wxJcSLJSABCUhg0hHQFTHpstwbloAEJCABCUhAAiMJKAhH8vCTBCQgAQlIQAISmHQEFISTLsu9YQlIQAISkIAEJDCSgIJwJA8/SUACEpCABCQggUlHQEE46bLcG5aABCQgAQlIQAIjCSgIR/LwkwQkIAEJSEACEph0BBSEky7LvWEJSEACEpCABCQwkoCCcCQPP0lAAhKQgAQkIIFJR0BBOOmy3BuWgAQkIAEJSEACIwkoCEfy8JMEJCABCUhAAhKYdAQUhJMuy71hCUhAAhKQgAQkMJKAgnAkDz9JQAISkIAEJCCBSUdAQTjpstwbloAEJCABCUhAAiMJKAhH8vCTBCQgAQlIQAISmHQEFISTLsu9YQlIQAISkIAEJDCSwLwjP/pJAhJoEoF5550342/KlCnZPPPYf2tS3vSSlqeeeip78skns0cffTR7+OGHewnCayY4galTp2bzzTdftuiii/rMT/C8btrtKQibliOmRwL/JbDAAgvkYlAgEpDA5CEwZ86cjL8nnngiW2yxxbIFF1xw8ty8d1orAV0OteI3cgmUE1AMlnPxqAQmC4Fnn302e/DBBzO8ypoEqiCgIKyCsnFIoAsCMUzcxSWeKgEJTFACDz300AS9M2+raQQUhE3LEdMz6QkgCDUJSEACEHj66aezZ555RhgSGDgBBeHAERuBBLojwAISTQISkEAQUBAGCV8HSWBSCMKFFlooW3755fvKkRWfenL6itTA/kvA1cQWBQlIQAISqJrAhBWESy65ZDZ9+vRs6aWXzg488MDs9a9/fbbsssv2he/iiy+eHXDAAdlee+1ViyhkWwL+JpstvPDC2SqrrDLitsnn5ZZbLt+WZcQXLT5ssskm2UYbbZSxaCNsyy23zNZaa618q4c45qsEJCABCUhgMhGYuuKKKx5U5w2/4AUvyKZNm5Y36Pfcc0/fkrLddttlNP6IhZtuuil77nOfm/3P//xPdtVVV2Ws3koNcYW3bzS3/Jprrpntueee+ZyO5zznObnAZEsAwq/SNttss2yPPfbIVltttezWW2/NtyfoJf5lllkm23nnnbP11lsvmzlzZn5fvYTTz2sQaghuhDxe3ZVXXjnbYIMNMsoJebrhhhtmlJN77703F3Vvfetb83y+5JJLRs0/PG+77757ts466+Qr926//fZs/vnnz4+tu+662axZs7L77ruvn7fTU1ikSZuYBKhj2FIk9iOcmHfZ/V3x3MNFKyfAKJcjB+VsPNo/ArXPXl977bUzhMkdd9zRv7saCum8887LVl999WyllVbKbrzxxuw///lPLuAQU4iH1F760pdmpOPqq6/OLrvssnypf/p9+n6RRRbJtt566+yUU07Jdtxxx2zjjTfO/vnPf+ZiIj1vkO/XX3/9XMBSiY5lBdpSSy2Vi0rS2u/KGIFNviKcH3nkkezuu+/OHnvssbZYyK9Xv/rVpefQkCIC77rrruFtGNini0qS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)

CleanShot 2026-01-04 at 15.03.51@2x.png

Gemini 3 Flash PreviewRan for 11s

lightbulbThought for 10 seconds

シニア UI エンジニア兼実装担当として、ドキュメントサイズ変更機能の設計と実装プランを提案します。

本設計では、**「アンカー点を中心とした空間の再定義」**をコアコンセプトとし、計算ロジックを純粋関数として分離することで、Undo/Redo やパフォーマンス要件に対応します。

---

### 1. データモデル設計 (TypeScript)

まず、幾何情報と状態を定義します。

codeTypeScript

```
// アンカー位置の定義
export enum AnchorType {
  TOP_LEFT = 'TL', TOP_CENTER = 'TC', TOP_RIGHT = 'TR',
  MIDDLE_LEFT = 'ML', CENTER = 'C', MIDDLE_RIGHT = 'MR',
  BOTTOM_LEFT = 'BL', BOTTOM_CENTER = 'BC', BOTTOM_RIGHT = 'BR'
}

// 変更モード
export enum ResizeMode {
  RESCALE_OBJECTS = 'RESCALE',
  FIX_TO_PAGE = 'FIX'
}

// オブジェクトの最小幾何情報
export interface IGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // degree
  scaleX: number;
  scaleY: number;
}

// ダイアログの状態
export interface ResizeParams {
  newW: number;
  newH: number;
  mode: ResizeMode;
  anchor: AnchorType;
  rescaleStroke: boolean; // ストロークを拡縮するか
}
```

---

### 2. 座標変換アルゴリズム

計算ロジックは UI フレームワークに依存させず、独立した  GeometryLogic  クラスとして実装します。

#### アンカー座標の算出

codeTypeScript

```
const getAnchorPoint = (w: number, h: number, anchor: AnchorType): { x: number, y: number } => {
  const horizontal = { L: 0, C: 0.5, R: 1 };
  const vertical = { T: 0, M: 0.5, B: 1 };

  // AnchorTypeの文字列から計算（例: TOP_LEFT -> x=0, y=0）
  // 実際はenumの値に応じたswitch/mapで実装
  const mapping: Record<AnchorType, { x: number, y: number }> = {
    [AnchorType.TOP_LEFT]: { x: 0, y: 0 },
    [AnchorType.CENTER]: { x: w * 0.5, y: h * 0.5 },
    [AnchorType.BOTTOM_RIGHT]: { x: w, y: h },
    // ... 他の6点も同様
  };
  return mapping[anchor];
};
```

#### メイン変換関数

codeTypeScript

```
export const calculateNewGeometry = (
  obj: IGeometry,
  oldDoc: { w: number, h: number },
  params: ResizeParams
): IGeometry => {
  const { newW, newH, mode, anchor } = params;
  const oldA = getAnchorPoint(oldDoc.w, oldDoc.h, anchor);
  const newA = getAnchorPoint(newW, newH, anchor);

  if (mode === ResizeMode.FIX_TO_PAGE) {
    // A. ページに固定: アンカーの移動量だけ座標をシフト
    return {
      ...obj,
      x: obj.x + (newA.x - oldA.x),
      y: obj.y + (newA.y - oldA.y)
    };
  } else {
    // B. 再スケール: アンカー基準で拡大縮小
    const sx = newW / oldDoc.w;
    const sy = newH / oldDoc.h;

    return {
      ...obj,
      x: newA.x + (obj.x - oldA.x) * sx,
      y: newA.y + (obj.y - oldA.y) * sy,
      w: obj.w * sx,
      h: obj.h * sy,
      // ストローク等は上位レイヤーで (sx+sy)/2 を用いて補正
    };
  }
};
```

---

### 3. UI（ダイアログ）の実装方針

#### 状態管理

- temporaryParams: ダイアログ内でのみ保持するサイズやモード。
- バリデーション: width, height  が 0 以下の場合は「適用」を非活性化。
- 比率保持: const [lockAspectRatio, setLock] = useState(true)  を持ち、片方の入力時に計算。

#### アンカーセレクターの UI

- 3x3 のボタン配置。CSS Grid を使用。
- aspect-ratio: 1/1  のボタンで、選択中のアンカーを  bg-blue-500  等で強調。

---

### 4. テストケース

1. **[FIX] 左上固定 (TOP_LEFT):** old(100,100) -> new(200,200)  でオブジェクト座標が変化しないこと。
2. **[FIX] 右下固定 (BOTTOM_RIGHT):** old(100,100) -> new(200,200)  でオブジェクト座標が  +100, +100  されること。
3. **[RESCALE] 中央基準:** old(100,100) -> new(200,200)  で中央にあるオブジェクトがそのまま中央に残り、サイズが 2 倍になること。
4. **[RESCALE] 比率違い:** old(100,100) -> new(200,100) (横長) で  x  と  w  だけが変化し、y  と  h  が維持されること。
5. **[Boundary] 極小サイズ:** 1px 以下への縮小時にエラーを投げず、最小値を維持するか適切に処理されること。
6. **[Boundary] ゼロガード:** oldW  が 0 の場合、Rescale  計算で  Infinity  にならないようガードされていること（初期ロード直後など）。
7. **[Perf] 大量オブジェクト:** 10,000 個のオブジェクトに対して処理が 16ms(1 フレーム)以内で完了すること。
8. **[Undo] 整合性:**  サイズ変更実行 → Undo 後に  document.width  とオブジェクト座標が 1bit の誤差なく一致すること。
9. **[UI] 比率ロック:**  比率ロック ON で W を 2 倍にした時、H も即座に 2 倍の数値が表示されること。
10. **[Rotation] 回転耐性:**  回転しているオブジェクトも、バウンディングボックス基準ではなく「中心点（またはアンカー）」が正しくスケーリングされること。

---

### 5. 受け入れ基準 (Acceptance Criteria)

- **FIX 挙動:**  ユーザーが選択したアンカー位置（例：右下）に配置したロゴが、キャンバスを広げても「右下からの相対位置」が変わらずに見えること。
- **RESCALE 挙動:**  キャンバスを倍にしたら、すべての要素が相似形で倍になり、重なり順や相対的なレイアウトが崩れないこと。
- **Undo 復元:**  サイズ変更後、Undo をクリックした瞬間にすべてのオブジェクトとキャンバスサイズが完全に元通りになること。
- **UI レスポンス:**  数値入力がスムーズで、アンカー選択のフィードバックが視覚的に明確であること。

---

### 6. 実装手順（タスク分解）

1. **Phase 1: Logic (Day 1)**

   - GeometryLogic  の作成とユニットテスト（上記変換式の検証）。

2. **Phase 2: UI Component (Day 1-2)**

   - 3x3 アンカーセレクターの実装。
   - 数値入力フィールド（比率ロックロジック含む）の実装。

3. **Phase 3: Integration (Day 2)**

   - ダイアログを既存アプリの Store/State に接続。
   - トランザクション処理（Undo 用の一括更新）の実装。

4. **Phase 4: Optimization & Polish (Day 3)**

   - 縮小時のはみ出しプレビュー（必要なら）。
   - ストロークやフォントサイズの補正ロジックの追加。

### 補足：ストロークの扱い (MVP 拡張)

MVP では、オブジェクトの  w, h  を変える際に、必要に応じて  strokeWidth  に対して  Math.sqrt(sx \* sy) （幾何平均）を掛けるフラグを設けることを推奨します。これにより、極端な横長拡大時でも線が太くなりすぎるのを防げます。

