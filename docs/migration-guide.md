# 移行ガイド - STEM研究部勤怠管理システム

## 🔄 既存システムとの統合における重要な注意点

### 1. **データ構造の互換性**

#### ✅ 完了済み
- [x] 基本的なコレクション（users, attendance_logs, teams, link_requests）
- [x] Timestampの型安全性
- [x] オプショナルフィールドの追加

#### 🔄 追加対応済み
- [x] workdays コレクション（労働日管理）
- [x] summary コレクション（月次サマリー）
- [x] Firestore セキュリティルールの更新

## 🔄 旧プロジェクトのFirebase構成の真実

### **重要な発見：2つのFirebaseプロジェクト構成**

旧プロジェクトでは以下の構成を使用していました：

#### **プロジェクトA（認証専用）**
- **目的**: Firebase Authentication + GitHub OAuth
- **機能**: ユーザー認証のみ
- **設定**: Firebase AuthがGitHub連携で有効
- **生成UID**: Firebase Auth UID（28文字）例：`0BDpjjLZdIYwlSjumHI0Kmv8w7c2`

#### **プロジェクトB（データ専用）**
- **目的**: Firestore データベース
- **機能**: 出勤データ、ユーザー情報の保存
- **設定**: **Firebase Authは設定されていない**
- **UID使用**: プロジェクトAで生成されたFirebase Auth UIDを参照

### **データ構造の関係性**

```typescript
// プロジェクトAで認証 → Firebase Auth UID生成
const user = await signInWithPopup(auth, githubProvider)  // プロジェクトA
const firebaseUID = user.uid  // 例: "0BDpjjLZdIYwlSjumHI0Kmv8w7c2"

// プロジェクトBでデータ保存
await setDoc(doc(db, "users", firebaseUID), userData)  // プロジェクトB
```

### **Firestoreデータの実際の構造**

```json
// users コレクション（プロジェクトB）
{
  "0BDpjjLZdIYwlSjumHI0Kmv8w7c2": {    // ← ドキュメントキー（Firebase Auth UID）
    "uid": "0BDpjjLZdIYwlSjumHI0Kmv8w7c2",  // ← 同じUID値
    "github": "sb.mao",
    "firstname": "0317",
    "lastname": "Mao"
  }
}

// attendance_logs コレクション（プロジェクトB）
{
  "logId": {
    "uid": "0BDpjjLZdIYwlSjumHI0Kmv8w7c2",  // ← 同じFirebase Auth UID
    "type": "entry",
    "timestamp": {...}
  }
}
```

### **新プロジェクトでの影響**

#### ✅ **確認済み事実**
- UIDは確実にFirebase Authentication由来（28文字の英数字）
- ドキュメントキーとUID値が完全一致
- GitHub OAuthは別プロジェクト（プロジェクトA）で処理

#### 🔄 **移行戦略の調整**

1. **UID形式の保持**:
   ```typescript
   // 既存のFirebase Auth UIDをそのまま使用
   const existingUID = "0BDpjjLZdIYwlSjumHI0Kmv8w7c2"
   // 新しい認証でも同じUIDでアクセス
   ```

2. **認証方式の変更**:
   ```typescript
   // 旧: Firebase Auth (プロジェクトA) → Firestore (プロジェクトB)
   // 新: GitHub OAuth (直接) → Firestore (統合プロジェクト)
   ```

3. **GitHubアカウント照合の重要性**:
   - Firebase Auth UIDとGitHubアカウントの紐づけは既存データで確認済み
   - `github`フィールドで既存ユーザーを特定可能

### **移行戦略の実装**

1. **GitHubアカウント名による照合**:
   ```typescript
   // data-adapter.ts で実装済み
   const findUserByGitHub = async (githubLogin: string): Promise<AppUser | null>
   ```

2. **UID形式の統一**:
   ```typescript
   // 新規ユーザー: github_{githubId} 形式
   const newUid = `github_${githubUser.id}`;
   
   // 既存ユーザー: 元のFirebase UIDを保持
   firebaseUid: firebaseUid // 移行時に保存
   ```

3. **後方互換性の確保**:
   ```typescript
   // 複数のUID形式に対応した検索
   export const getUserWithTeamInfo = async (uid: string): Promise<AppUser | null>
   ```

### **データ整合性の確保**

#### ✅ 対応済み
- [x] 既存Firebase UIDと新GitHub UIDの両方をサポート
- [x] GitHubアカウント名による既存ユーザー検索
- [x] 移行用の`firebaseUid`フィールド追加
- [x] 複数UID形式対応の検索機能

#### 🔄 今後の対応
- [ ] 既存の出勤ログデータとの関連付け確認
- [ ] バッチ移行スクリプトの作成（必要に応じて）
- [ ] 管理者向けユーザー統合ツール

### **実際のデータ例**

```json
// 既存システムのユーザーデータ
{
  "uid": "bpXLLoP3aBPor1IhGlM9oHvA2Z23",  // Firebase Auth UID (28文字)
  "github": "sb.mao",
  "firstname": "0317",
  "lastname": "Mao",
  "teamId": "web",
  "grade": 10,
  "cardId": "010102129b1dc802"
}

// 新システムでの移行後データ
{
  "uid": "bpXLLoP3aBPor1IhGlM9oHvA2Z23",  // 既存UIDを維持
  "firebaseUid": "bpXLLoP3aBPor1IhGlM9oHvA2Z23",  // 移行記録
  "github": "sb.mao",
  "githubId": 987654321,  // GitHub API ID
  "githubLogin": "sb.mao",
  "oauthProvider": "github",
  // その他のフィールドは既存のまま維持
}
```

### 3. **Raspberry Pi連携機能**

#### 重要な機能
- QRコード生成（UUID トークン）
- リアルタイムトークン状態監視
- NFCカード読み取り連携
- スマートフォンとの連携フロー

#### 実装済み
- [x] `LinkRequest`型定義
- [x] トークン生成・監視機能
- [x] QRLinkComponentの基本実装

### 4. **必要な環境変数**

```env
# GitHub OAuth（既存の設定）
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Firebase Configuration（既存システム互換）
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# アプリケーション設定
NEXTAUTH_URL=http://localhost:80
NEXTAUTH_SECRET=your_nextauth_secret
NEXT_PUBLIC_BASE_URL=http://localhost:80
```

### 5. **データ移行での注意点**

#### 必須チェック項目
- [ ] 既存ユーザーのGitHubアカウント情報の整合性確認
- [ ] CardID連携データの正確性確認
- [ ] チームメンバーシップの維持
- [ ] 出勤履歴データの継続性確認
- [ ] 労働日・サマリーデータの移行確認

#### セキュリティ
- [x] Firestoreルールの更新（OAuth認証対応）
- [ ] 管理者権限の実装
- [ ] カード連携のセキュリティ検証

### 6. **今後の実装予定**

#### 高優先度
1. 管理者ダッシュボードの移行
2. NFCカードリーダー統合
3. 労働日管理機能
4. 月次レポート機能

#### 中優先度
1. チーム管理機能の拡張
2. 出勤データの可視化
3. アラート・通知機能

### 7. **既存システム参照ファイル**

重要な参照先：
- `IT_KintaiKanri-main/docs/DBの構造的な.md` - データベース構造
- `IT_KintaiKanri-main/docs/要件定義書のような何か.md` - システム要件
- `IT_KintaiKanri-main/kintaikanri-admin/src/lib/firebase/` - Firebase設定
- `IT_KintaiKanri-main/kintaikanri/firestore.rules` - セキュリティルール
