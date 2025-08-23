# Firebase Admin SDK セットアップガイド

マイグレーションスクリプトを実行するには、Firebase Admin SDKの認証が必要です。
以下の方法で設定してください。

## セットアップ方法

### サービスアカウントキーファイル（推奨）

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
    
    **重要:** ファイル名は必ず `firebase-service-account-key.json` としてください。

## マイグレーション実行

設定完了後、以下のコマンドでスクリプトを実行します。

```bash
npm run migrate:attendance
```

## 注意事項

*   サービスアカウントキーファイル (`firebase-service-account-key.json`) は `.gitignore` に追加済みのため、Gitリポジトリには含まれません。
*   本番環境などでファイルを直接配置できない場合は、一時的にこの方法でローカル環境で移行を実行することを推奨します。
