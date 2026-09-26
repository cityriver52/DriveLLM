# DriveLLM
## Google Drive + GAS + Chrome Local LLM 基盤
### Codex引継書・要件定義書

## 1. プロジェクト概要

### 名称
**DriveLLM**

### コンセプト

Google Workspaceを中心とした環境で、

- Google Driveをデータ保存基盤
- Google Apps Script（GAS）をWebアプリ／バックエンド
- Google ChromeをLLM実行環境
- WebGPUを利用して利用者PC上でローカル推論

という構成により、外部LLM APIへ文章を送信せずにAI機能を提供する。

重要な設計思想は以下。

> **Drive is the storage. GAS is the control plane. Chrome is the compute.**

GASサーバー上でLLMを動かそうとしないこと。

LLM推論は原則として利用者のChrome内で実行する。

---

## 2. 背景

Google Workspace中心の組織環境では、セキュリティポリシー等により、

- OpenAI API
- Anthropic API
- 任意の外部Web API
- ローカルPCへの自由なソフトウェアインストール
- Pythonサーバー
- Node.jsサーバー

等が使用できない場合がある。

一方、

- Google Drive
- Google Apps Script
- Google Workspace
- Google Chrome

は利用可能な場合がある。

そこで、ブラウザ内で動作するローカルLLMを利用し、

```text
Google Drive
      ↓
Google Apps Script
      ↓
GAS Web App
      ↓
Google Chrome
      ↓
WebGPU
      ↓
Local LLM
```

という構成を作る。

外部AIサービスを推論に使用しない。

---

## 3. 最終的に実現したいもの

ユーザーがGAS Webアプリへアクセスすると、シンプルなチャットUIが開く。

```text
┌─────────────────────────┐
│ DriveLLM                │
│                         │
│ Model: XXXXX            │
│ Runtime: WebGPU         │
│ Status: Ready           │
│                         │
│ ┌─────────────────────┐ │
│ │質問を入力            │ │
│ └─────────────────────┘ │
│                         │
│      [送信]             │
│                         │
│ AI回答……                │
└─────────────────────────┘
```

質問を送信すると、

```text
ユーザー入力
     ↓
Google Chrome
     ↓
ローカルLLM
     ↓
WebGPU推論
     ↓
回答
```

となる。

入力文章を外部AI APIには送信しない。

---

## 4. 基本アーキテクチャ

```text
                  Google Workspace

┌───────────────────────────────┐
│ Google Drive                  │
│                               │
│ /DriveLLM                     │
│   /config                     │
│   /prompts                    │
│   /knowledge                  │
│   /models                     │
│   /logs                       │
└──────────────┬────────────────┘
               │
               │ Drive access
               ▼
┌───────────────────────────────┐
│ Google Apps Script            │
│                               │
│ ・Web App                     │
│ ・設定取得                    │
│ ・Drive読み書き               │
│ ・文書取得                    │
│ ・認証                        │
│ ・ログ保存                    │
│                               │
│ ※LLM推論はしない             │
└──────────────┬────────────────┘
               │
               │ HTML Service
               ▼
┌───────────────────────────────┐
│ Google Chrome                 │
│                               │
│ DriveLLM Frontend             │
│                               │
│ WebLLM / Transformers.js等    │
│           ↓                   │
│ WebGPU                        │
│           ↓                   │
│ Local LLM inference           │
└───────────────────────────────┘
```

---

## 5. 最重要設計原則

### 原則1：GASでLLMを実行しない

Apps ScriptはLLM推論サーバーとして使用しない。

GASの役割は、

- UI配信
- Driveアクセス
- 設定管理
- 文書取得
- ログ管理

に限定する。

### 原則2：推論はChrome側で行う

原則として、

- WebGPU
- WebAssembly

等を利用する。

第一候補として以下を検証する。

- WebLLM
- Transformers.js

技術選択はCodex側で実装時点の互換性を調査して決定してよい。

ただし、

**GAS HTML Service内でGoogle Chrome上から実際に動作すること**

を最優先する。

### 原則3：まず小さなモデルから検証する

最初から数Bパラメータのモデルを動かそうとしない。

PoCでは100M〜500M程度、または同等に軽量なモデルを利用する。

目的は性能評価ではなく、

```text
GAS Web App
    ↓
Google Chrome
    ↓
WebGPU
    ↓
Local LLM
```

という経路が成立することの確認である。

---

## 6. Phase 0：環境診断

最初にLLMを実装せず、**DriveLLM Diagnostics** 画面を作る。

以下をChrome上に表示する。

```text
Browser
Google Chrome XXX

WebGPU
Available / Unavailable

navigator.gpu
true / false

GPU Adapter
XXXX

WebAssembly
Available

IndexedDB
Available

Cache Storage
Available

Device Memory
取得可能なら表示

GAS iframe
正常動作
```

最低限 `navigator.gpu` が利用可能か確認する。

### 合格条件

GAS Web Appを職場のGoogle Chromeで開き、

```text
WebGPU: Available
```

となること。

WebGPU不可の場合もアプリをクラッシュさせず、

```text
このChrome環境ではWebGPUが利用できません。
```

と表示する。

---

## 7. Phase 1：Hello Local LLM

Drive連携はまだ行わない。

Google Chromeだけで、ユーザー入力に対してローカルLLMが回答するところまで作る。

```text
DriveLLM

Model
[モデル名]

Status
Loading...

████████░░ 80%

↓

Ready

----------------

User
こんにちは

Assistant
こんにちは。今日は……
```

### 必須機能

- モデル読み込み
- 読み込み進捗表示
- 推論開始
- ストリーミング表示
- Stopボタン
- エラー表示

---

## 8. Phase 2：モデルキャッシュ

モデルを毎回ダウンロードしない。

Chromeの、

- Cache Storage
- IndexedDB
- 使用ライブラリ側のモデルキャッシュ

等を利用する。

### 初回

```text
モデルロード
↓
Downloading
↓
Local cache
↓
Ready
```

### 2回目以降

```text
Local cache found
↓
Loading
↓
Ready
```

モデルの取得元も表示できるようにする。

```text
Model source:
Local Cache
```

または

```text
Model source:
Downloaded
```

---

## 9. Phase 3：Google Drive連携

Google Drive内に以下の構造を想定する。

```text
DriveLLM/

├── config/
│   └── config.json
│
├── prompts/
│   └── system_prompt.txt
│
├── knowledge/
│
├── models/
│
└── logs/
```

---

## 10. config.json

例：

```json
{
  "appName": "DriveLLM",
  "model": "MODEL_NAME",
  "temperature": 0.7,
  "maxTokens": 512,
  "systemPromptFile": "system_prompt.txt",
  "enableRag": false,
  "saveConversation": false
}
```

GASから取得し、フロントエンドへ渡す。

モデル名等をコードへハードコードしすぎないこと。

---

## 11. プロンプト管理

Drive：

```text
/prompts/system_prompt.txt
```

例：

```text
あなたは組織内部で利用する業務支援AIです。

提供された資料に基づいて回答してください。

資料に記載されていない内容については推測せず、
分からないと回答してください。
```

GAS経由で取得する。

---

## 12. Phase 4：Drive RAG

最終的にはGoogle Drive内文書に対して質問できるようにする。

```text
質問
 ↓
Drive検索
 ↓
関連文書取得
 ↓
必要部分抽出
 ↓
Chromeへ送信
 ↓
Local LLM
 ↓
回答
```

GAS側は関連文書または必要部分だけをChromeへ渡す。

Chrome側で、

```text
SYSTEM

以下の資料のみを根拠として回答してください。

CONTEXT

...

USER

○○制度について教えて
```

のようなプロンプトを構築し、ローカルLLMへ入力する。

---

## 13. RAGは段階的に実装する

初期版では高度なVector DBを作らない。

実装順：

1. ファイル名検索
2. 全文キーワード検索
3. チャンク化
4. Embedding
5. ベクトル検索

まずLevel 1〜2で実用性を確認する。

---

## 14. Embedding

将来的にはEmbeddingもChrome側でローカル実行可能にする。

```text
Drive document
↓
GAS
↓
テキスト取得
↓
Chrome
↓
Local Embedding Model
↓
Embedding
↓
IndexedDB
```

これにより、文書をEmbedding APIへ送信しない構成を維持する。

---

## 15. モデルファイルの扱い

最終的には、

```text
DriveLLM/models/
```

へモデルファイルを置く構成も検討する。

ただし、

**巨大なモデルをGAS経由でそのまま配信しない。**

Apps Scriptの制限に抵触する可能性があるため、複数案を検証する。

### 案A：初回のみ通常のモデル配布元から取得

```text
モデル配布元
↓
Chrome
↓
Local Cache
```

最も簡単。

### 案B：Google Driveからモデル取得

```text
Google Drive
↓
Chrome
↓
Local Cache
```

「Google Workspace内完結」という思想に最も近い。

### 案C：モデル分割

```text
models/

model-001.bin
model-002.bin
model-003.bin
```

必要に応じてChrome側で処理する。

Phase 1では案Aでもよい。

ただし後続フェーズで、

**Google Workspace + Chromeのみで完結する構成**

を検証する。

---

## 16. セキュリティ原則

ユーザーの質問やDrive文書について、原則として以下へ送信しない。

```text
OpenAI
Anthropic
Gemini API
Hugging Face Inference API
その他の外部AI推論API
```

ローカル推論であることをUI上でも確認可能にする。

例：

```text
Inference

● Local Chrome
  WebGPU

External AI API

● Not used
```

注意：

モデル本体の初回取得元として外部CDNやモデル配布元を利用する場合、それは「外部推論APIの利用」とは別物である。

ただし最終的に完全閉域的な構成を目指す場合は、モデル本体についてもDriveから取得できる構成を検討する。

---

## 17. Privacy / Diagnostics表示

将来的には以下を表示する。

```text
Privacy Monitor

LLM inference
LOCAL

Prompt sent to external AI service
NO

Drive access
Google Apps Script

External AI API
NONE
```

ユーザーが処理場所を理解できるようにする。

---

## 18. UI

Google Workspace系Webアプリに馴染む、シンプルなUIとする。

```text
DriveLLM
─────────────────────

Model
Qwen xxx

Runtime
Chrome / WebGPU

Status
● Ready

─────────────────────

Chat

USER
○○について説明して

ASSISTANT
……

─────────────────────

[質問を入力……           ]

                       [Send]
```

---

## 19. Settings

最低限以下を設定可能にする。

- Model
- Temperature
- Max tokens
- System prompt
- RAG ON / OFF
- Conversation log ON / OFF

---

## 20. Diagnostics画面

トラブルシューティングのため重要。

```text
DriveLLM Diagnostics

Browser
Google Chrome xxx

WebGPU
Available

GPU
xxxx

Local storage
OK

IndexedDB
OK

Model cache
1.2GB

Model
Qwen xxx

Runtime
WebLLM

Last inference
42 tok/s
```

---

## 21. パフォーマンス表示

可能なら以下を表示する。

```text
Prefill
xx tok/s

Decode
xx tok/s

Total tokens
xxx

Generation time
xx sec
```

必須ではない。

---

## 22. 会話ログ

デフォルトは保存しない。

```text
Save conversation
OFF
```

設定でONにした場合のみDriveへ保存する。

```text
DriveLLM/logs/

2026-xx-xx_xxxxxx.json
```

---

## 23. GAS側の責務

### GASが行うこと

- Web App配信
- Googleユーザー認証
- Driveファイル取得
- 設定取得
- プロンプト取得
- RAG文書取得
- 必要に応じたログ保存

### GASが行わないこと

- LLM inference
- Embedding inference
- モデル演算
- 巨大モデル処理

---

## 24. Chrome側の責務

- WebGPU初期化
- モデルロード
- モデルキャッシュ
- LLM inference
- Streaming generation
- 将来的なEmbedding
- RAG context組立
- UI

---

## 25. エラーハンドリング

最低限以下を区別する。

```text
WEBGPU_NOT_AVAILABLE

MODEL_DOWNLOAD_FAILED

MODEL_LOAD_FAILED

INSUFFICIENT_MEMORY

DRIVE_ACCESS_FAILED

GAS_TIMEOUT

INFERENCE_FAILED
```

ユーザー向けには分かりやすく表示する。

例：

```text
モデルの読み込みに失敗しました。

考えられる原因：
・ChromeでWebGPUが利用できない
・端末メモリ不足
・モデルキャッシュ破損
```

詳細ログはDeveloper向け表示で確認可能にする。

---

## 26. 最初の技術検証

最初に確認する経路はこれだけ。

```text
GAS HTML Service
↓
Google Chrome
↓
navigator.gpu
↓
WebGPU
↓
LLM library
↓
Small model
↓
Inference
```

この経路が成立しなければ、その後の大規模実装に進まない。

---

## 27. 開発順序

### Stage 0
GAS Web Appを作る。

### Stage 1
DriveLLM Diagnostics。

### Stage 2
小型モデルをChrome上で実行。

### Stage 3
モデルキャッシュ。

### Stage 4
Drive設定ファイル連携。

### Stage 5
system prompt連携。

### Stage 6
Drive文書取得。

### Stage 7
簡易RAG。

### Stage 8
Embedding RAG。

### Stage 9
Drive内モデル配布検証。

---

## 28. PoC成功条件

以下を満たせばPoC成功。

1. GAS Web Appとして公開できる。
2. 職場のGoogle Chromeからアクセスできる。
3. WebGPUが利用できる。
4. Chrome内でLLMがロードされる。
5. 質問へ回答できる。
6. 回答生成時に外部LLM APIを使用しない。
7. 2回目以降モデルキャッシュを利用できる。

---

## 29. MVP成功条件

さらに以下を満たす。

```text
Google Drive
↓
system prompt
↓
GAS
↓
Chrome Local LLM
```

および、

```text
Google Drive 文書
↓
GAS
↓
Google Chrome
↓
Local LLM
↓
文書に基づく回答
```

が可能であること。

---

## 30. 完全版の目標

最終的には、

```text
Google Workspace
+
Google Chrome
```

だけで動くPrivate AI Platformとして成立させる。

ユーザー側から見れば、

```text
Google Driveに

文書
プロンプト
設定
知識

を置く

↓

DriveLLMを開く

↓

AIとして利用
```

という状態を目指す。

---

## 31. 将来構想

DriveLLMを単なるチャットボットではなく、

**Google Drive上のデータとChrome上のローカル推論を組み合わせるAI実行基盤**

として設計する。

将来的な例：

- DriveLLM Chat
- DriveLLM RAG
- DriveLLM Summarizer
- DriveLLM Document Assistant
- DriveLLM Classification
- DriveLLM Extraction

共通ランタイムとして、

```text
Prompt
+
Drive Data
+
Chrome Local LLM
```

を再利用できるようにする。

---

## 32. 避けること

### NG
GASでLLM推論する。

### NG
最初から巨大モデルを使う。

### NG
最初から高度なRAGを作る。

### NG
大量のDriveデータをすべてChromeへ送る。

### NG
モデルファイルをGASで無理に中継する。

### NG
外部AI APIへ自動フォールバックする。

外部AI APIを必要としないこと自体が、このプロジェクトの重要な特徴である。

---

## 33. Codexへの初回タスク

リポジトリが存在しなければ、概ね以下の構成を作る。

```text
drivellm/

README.md

docs/
    ARCHITECTURE.md
    DEVELOPMENT.md
    SECURITY.md

gas/
    Code.gs
    index.html
    javascript.html
    stylesheet.html

src/
    runtime/
    model/
    storage/
    diagnostics/
    rag/

tests/
```

ただしGASとの互換性を優先し、構成は必要に応じ変更してよい。

---

## 34. Codexが最初に実装するもの

最初からLLMチャットを作らない。

まず **DriveLLM Diagnostics** を実装する。

GAS Web Appを職場のGoogle Chromeで開き、

- WebGPU
- navigator.gpu
- GPU adapter
- IndexedDB
- Cache Storage
- WebAssembly

の利用可否を確認できるようにする。

その後、

**GAS HTML Service内でChrome上のブラウザLLMを動かせる技術構成を調査し、最小モデルによる推論PoCを追加する。**

---

## 35. README冒頭案

```text
# DriveLLM

DriveLLM is a private browser-based LLM platform
built on Google Drive, Google Apps Script, and Google Chrome.

Google Drive stores knowledge and configuration.
Google Apps Script provides the application layer.
LLM inference runs locally in Google Chrome using WebGPU.

No external AI inference API is required.

Drive is the storage.
GAS is the control plane.
Chrome is the compute.
```

---

## 36. Codexへの技術判断権

以下については実装時点で調査し、最適なものを選択してよい。

- WebLLM vs Transformers.js
- 使用モデル
- モデル形式
- 量子化形式
- キャッシュ方式
- Web Worker利用
- Service Worker利用
- IndexedDB設計

ただし、

```text
Google Drive
↓
GAS
↓
Google Chrome
↓
WebGPU
↓
Local LLM
```

という基本思想は変更しない。

---

## 37. 最初のゴール

最初のコミット：

```text
DriveLLM

Diagnostics

Browser
Google Chrome

WebGPU
Available

GPU
XXXXX

IndexedDB
Available

Cache
Available
```

次のコミット：

```text
Model loading
↓
Hello
↓
Local LLM response
```

ここまで動けば、

**DriveLLMの基本構造が成立した**

と判断する。

---

## 38. このプロジェクトの本質

これは単に「ブラウザでLLMを動かしてみる」プロジェクトではない。

目的は、

> **Google WorkspaceとGoogle Chromeを利用できる環境に、外部AI推論APIに依存しないローカルAI実行レイヤーを構築できるか検証すること。**

Google Driveを知識・設定・永続化層、GASをアプリケーション層、Google ChromeをAI計算層として利用する。

それが **DriveLLM** の基本設計である。
