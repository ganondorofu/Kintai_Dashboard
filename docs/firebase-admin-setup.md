# Firebase Admin SDK セットアップガイド

マイグレーションスクリプトを実行するには、Firebase Admin SDKの認証が必要です。

## セットアップ方法

### 方法1: サービスアカウントキーファイル（推奨）

1. Firebase Consoleにアクセス
   - https://console.firebase.google.com/
   - データ用プロジェクトを選択

2. プロジェクト設定 → サービスアカウント
   - "新しい秘密鍵の生成" をクリック
   - JSONファイルをダウンロード

3. ファイル名を変更して配置
   ```
   ダウンロードしたファイル名: your-project-name-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
   配置場所: プロジェクトルート/firebase-service-account-key.json
   ```

### 方法2: 環境変数

1. `.env.local` ファイルを作成（`.env.local.example` を参考）

2. サービスアカウントキーから必要な情報を抽出
   ```env
   NEXT_PUBLIC_FIREBASE_DATA_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...private key content...\n-----END PRIVATE KEY-----\n"
   ```

## マイグレーション実行

```bash
npm run migrate:attendance
```

## 注意事項

- サービスアカウントキーファイルは `.gitignore` に追加済み
- 本番環境では環境変数の使用を推奨
- プライベートキーには改行文字 `\n` が含まれるため、適切にエスケープしてください
