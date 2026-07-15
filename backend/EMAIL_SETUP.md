# メール送信機能の初期設定

## 1. D1マイグレーション

```powershell
cd backend
npx wrangler d1 execute homecoming_db --remote --file=./migrations/20260716_email_notifications.sql
```

## 2. Brevo APIキーをCloudflare Secretへ登録

```powershell
cd backend
npx wrangler secret put BREVO_API_KEY
```

表示された入力欄へBrevoのAPIキーを貼り付けます。APIキーはGitHubやwrangler.tomlへ書かないでください。

## 3. デプロイ

```powershell
cd backend
npm install
npm run deploy
```

フロントエンドも通常どおりCloudflare Pagesへデプロイします。

## 4. 管理画面

管理者ログイン後、次のURLを開きます。

```text
/admin/email
```

ここで以下を設定できます。

- Brevoで認証済みの送信元メールアドレス
- 送信元表示名
- 開催日と開催場所
- 予約完了メールの件名・本文・有効化
- 開催何日前に送信するか
- 送信開始時刻
- 自動メールの追加・削除・有効化
- テスト送信
- 送信履歴の確認

## 差し込み項目

- `{{name}}`
- `{{email}}`
- `{{reservation_code}}`
- `{{participant_count}}`
- `{{category}}`
- `{{event_date}}`
- `{{event_location}}`

## 送信動作

- 予約完了メールは予約成功後に非同期送信します。
- 自動メールは5分ごとに対象を確認します。
- 1回の実行で最大40通を送り、残りは次の5分後に送ります。
- 同じテンプレートを同じ予約者へ重複送信しません。
- 失敗した送信は次回の実行で再試行します。
