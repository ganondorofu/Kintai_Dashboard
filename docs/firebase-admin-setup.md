# Firebase Admin SDK セットアップガイド

マイグレーションスクリプトを実行するには、Firebase Admin SDKの認証が必要です。
以下のいずれかの方法で設定してください。

## セットアップ方法

### 方法1: サービスアカウントキーファイル（推奨）

1.  **Firebase Consoleにアクセス**
    *   https://console.firebase.google.com/
    *   データ用プロジェクトを選択

2.  **プロジェクト設定 → サービスアカウント**
    *   "新しい秘密鍵の生成" をクリック
    *   JSONファイルをダウンロード

3.  **ファイル名を変更して配置**
    ```
    ダウンロードしたファイル名: your-project-name-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
    配置場所: プロジェクトルート/firebase-service-account-key.json
    ```

### 方法2: 環境変数

サービスアカウントキーファイルを直接配置できない環境（例: Vercel）の場合は、環境変数を使用できます。

1.  `.env.local` ファイルを作成（`.env` をコピー）
2.  サービスアカウントキーの内容を以下の環境変数に設定します。

    ```env
    # データ用プロジェクトのプロジェクトID
    NEXT_PUBLIC_FIREBASE_DATA_PROJECT_ID=your-project-id

    # サービスアカウントのクライアントメール
    FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

    # サービスアカウントのプライベートキー
    # JSONファイル内の`private_key`の値を改行文字（\n）を含めてそのままコピー
    FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...private key content...\n-----END PRIVATE KEY-----\n"
    ```

## マイグレーション実行

設定完了後、以下のコマンドでスクリプトを実行します。

```bash
npm run migrate:attendance
```

## 注意事項

*   サービスアカウントキーファイル (`firebase-service-account-key.json`) は `.gitignore` に追加済みのため、Gitリポジトリには含まれません。
*   本番環境では環境変数の使用を推奨します。
*   `FIREBASE_PRIVATE_KEY` には改行文字 `\n` が含まれるため、適切にエスケープしてください。多くのホスティングサービスでは、複数行の値をそのままペーストできます。
