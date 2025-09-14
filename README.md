# STEM研究部勤怠管理システム

IT学生向けの包括的な勤怠管理システムです。Firebase/Firestoreを基盤とした現代的なWebアプリケーションです。

## 🚀 主要機能

### 👥 ユーザーダッシュボード
- **リアルタイム勤怠記録**: ワンクリックで出勤・退勤を記録
- **個人統計**: 月次出席率、勤務時間、出席日数の詳細分析
- **勤怠履歴**: 過去の勤怠記録の詳細表示
- **チーム管理**: 所属チームの状況確認

### 👨‍💼 管理者ダッシュボード
- **リアルタイム統計**: 全体の出席状況をリアルタイム監視
- **チーム別分析**: 学年・チーム別の出席率と詳細統計
- **データエクスポート**: CSV形式での勤怠データ出力
- **月次統計**: キャッシュ機能付きの高速月次レポート

### 🏢 NFCキオスクシステム
- **NFCタグ対応**: 非接触カードでの高速勤怠記録
- **オフライン対応**: ネットワーク状況の監視と表示
- **音声フィードバック**: 記録完了時の音声案内
- **リアルタイム表示**: 現在時刻と日付の常時表示

## ⚙️ 自動強制退勤機能 (Cron Job)

本システムは、Firebase App HostingのCronジョブ機能を利用して、毎日決まった時間に全ユーザーを強制的に退勤させる機能を備えています。

### 仕組み
1.  **スケジュール実行**: `cron.yaml` ファイルに定義されたスケジュールに従い、Firebaseが自動的にAPIエンドポイントを呼び出します。
    - **設定ファイル**: `cron.yaml`
    - **スケジュール**: 毎日 日本時間の23時59分
    - **呼び出し先API**: `/api/force-clock-out`

2.  **時間帯チェック**: APIは、呼び出されると即座に処理を実行するわけではありません。まず、管理者ダッシュボードの「システム設定」で指定された**開始時刻**と**終了時刻**をデータベースから取得します。

3.  **強制退勤の実行**: 現在の時刻が管理者によって設定された時間帯の範囲内である場合のみ、出勤中の全ユーザーを対象に強制退勤処理を実行します。範囲外の場合は、何もせずに処理を終了します。

### 設定方法
- **スケジュール変更**: 実行時刻そのものを変更したい場合は、`cron.yaml` ファイルの `schedule` の値を編集します。
- **実行時間帯の変更**: 実際に処理が有効になる時間帯は、管理者ダッシュボードの「システム設定」タブからいつでも変更可能です。

### 手動でのテスト実行
`curl`コマンドを使用して、このAPIエンドポイントを任意に実行できます。これはテストや、緊急時の手動操作に便利です。

**ローカル開発環境の場合:**
```bash
curl http://localhost:80/api/force-clock-out
```

**デプロイ後の本番環境の場合:**
```bash
curl https://[あなたのアプリケーションのドメイン]/api/force-clock-out
```

実行すると、サーバー側で設定された時間帯のチェックが行われ、条件を満たせば強制退勤が実行されます。結果はJSON形式で返されます。

## 🏗️ データ構造

### 新しい階層構造
従来の単一コレクション構造から、効率的な階層構造に移行済み：

```
旧構造: /attendance_logs/{logId}
新構造: /attendances/{年月日}/logs/{logId}

例:
/attendances/2025-01-15/logs/user123_1737123456789
```

### 🔄 自動マイグレーション
- **既存データ保護**: レガシーIDを維持した完全なデータ移行
- **検証機能**: 移行前後のデータ整合性チェック
- **フォールバック**: 新構造にデータが無い場合は自動的に旧構造から取得

## 🛠️ 技術スタック

- **フロントエンド**: Next.js 15, React, TypeScript
- **バックエンド**: Firebase Functions, Firestore
- **認証**: Firebase Auth + GitHub OAuth
- **UI**: Tailwind CSS, shadcn/ui
- **状態管理**: React Hooks
- **リアルタイム**: Firestore リアルタイムリスナー

## 📦 セットアップ

### 必要な環境
- Node.js 18+
- Firebase プロジェクト
- GitHub OAuth App

### インストール
```bash
npm install
```

### 環境変数設定
`.env.local` ファイルを作成：
```env
# Firebase データ用設定
NEXT_PUBLIC_FIREBASE_DATA_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_DATA_API_KEY=your-api-key
# ... その他の設定
```

### 開発サーバー起動
```bash
npm run dev
```

### データマイグレーション
```bash
npm run migrate:attendance
```

## 🔧 管理

### Firebase Admin SDK設定
マイグレーション実行には以下が必要：
1. Firebase Service Account Key
2. プロジェクトルートに `firebase-service-account-key.json` を配置

詳細は `docs/firebase-admin-setup.md` を参照。

## 📊 パフォーマンス

- **日付別索引**: 高速な日付範囲検索
- **キャッシュ機能**: 月次統計の高速表示
- **効率的クエリ**: Firestore読み取り回数の最適化
- **リアルタイム更新**: 最小限のデータ転送

## 🚀 デプロイ

### Vercel
```bash
npm run build
vercel deploy
```

### Firebase Hosting
```bash
npm run build
firebase deploy
```

## 📁 プロジェクト構造

```
src/
├── app/                    # Next.js App Router
│   ├── dashboard/         # メインダッシュボード
│   └── kiosk/            # NFCキオスクページ
├── components/            # Reactコンポーネント
│   ├── dashboard/        # ダッシュボード関連
│   └── ui/              # 再利用可能UIコンポーネント
├── lib/                  # ユーティリティ
│   ├── data-adapter.ts   # Firestore操作
│   └── firebase.ts       # Firebase設定
└── scripts/              # 管理スクリプト
    └── migrate-attendance-data.ts
```

## 🔒 セキュリティ

- **Firestore Rules**: 適切なアクセス制御
- **認証必須**: 全ての操作に認証が必要
- **データ検証**: クライアント・サーバー両方での入力検証
- **HTTPS強制**: 全通信の暗号化

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
