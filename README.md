# IT勤怠管理システム

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
\`\`\`bash
npm install
\`\`\`

### 環境変数設定
\`.env.local\` ファイルを作成：
\`\`\`env
# Firebase データ用設定
NEXT_PUBLIC_FIREBASE_DATA_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_DATA_API_KEY=your-api-key
# ... その他の設定
\`\`\`

### 開発サーバー起動
\`\`\`bash
npm run dev
\`\`\`

### データマイグレーション
\`\`\`bash
npm run migrate:attendance
\`\`\`

## 🔧 管理

### Firebase Admin SDK設定
マイグレーション実行には以下が必要：
1. Firebase Service Account Key
2. プロジェクトルートに \`firebase-service-account-key.json\` を配置

詳細は \`docs/firebase-admin-setup.md\` を参照。

## 📊 パフォーマンス

- **日付別索引**: 高速な日付範囲検索
- **キャッシュ機能**: 月次統計の高速表示
- **効率的クエリ**: Firestore読み取り回数の最適化
- **リアルタイム更新**: 最小限のデータ転送

## 🚀 デプロイ

### Vercel
\`\`\`bash
npm run build
vercel deploy
\`\`\`

### Firebase Hosting
\`\`\`bash
npm run build
firebase deploy
\`\`\`

## 📁 プロジェクト構造

\`\`\`
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
\`\`\`

## 🔒 セキュリティ

- **Firestore Rules**: 適切なアクセス制御
- **認証必須**: 全ての操作に認証が必要
- **データ検証**: クライアント・サーバー両方での入力検証
- **HTTPS強制**: 全通信の暗号化

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
