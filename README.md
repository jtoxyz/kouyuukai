# kouyuukai

大阪産業大学ホームカミングデー「付属高校吹奏部演奏会」の予約受付システム。

## 構成

| ディレクトリ | 中身 | デプロイ先 |
| --- | --- | --- |
| `backend/` | Hono 製 API（Cloudflare Workers） | Worker `koyukai-backend` |
| `frontend/` | Next.js 静的エクスポート | Pages `koyukai` |

- 公開URL: <https://koyukai.pages.dev>
- API: <https://koyukai-backend.osukouyukai.workers.dev>
- フロントの `/api/*` は `frontend/functions/api/[[path]].js` が Worker へ転送する

## Cloudflare リソース

| 種別 | 名前 | ID |
| --- | --- | --- |
| Worker | `koyukai-backend` | — |
| Pages | `koyukai` | — |
| D1 | `homecoming_db` | `2bc334ff-77dd-468e-aae4-4f9d81457b39` |

Worker の secret（`wrangler secret put` で登録、リポジトリには置かない）:

- `ADMIN_PASSWORD` — 管理画面のログインパスワード
- `SESSION_SECRET` — 管理セッション JWT の署名鍵
- `BREVO_API_KEY` — Brevo（メール送信）の API キー

## デプロイ

`main` への push で自動デプロイされる。Worker 側のビルド設定は次のとおり。

| 項目 | 値 |
| --- | --- |
| Root directory | `backend` |
| Build command | `npm install` |
| Deploy command | `npx wrangler deploy` |
| Version command | `npx wrangler versions upload` |
| Production branch | `main` |

手動でデプロイする場合:

```bash
cd backend && npx wrangler deploy          # API
cd frontend && npm run build && npx wrangler pages deploy out --project-name koyukai --branch main
```

## 動作確認

```bash
curl https://koyukai-backend.osukouyukai.workers.dev/api/health
```

`{"status":"ok","database":"ok"}` が返れば Worker と D1 の疎通は正常。

## 注意点

- **`backend/wrangler.toml` の `database_id` は実在する `homecoming_db` の ID と一致させること。** 古い ID が残っているとデプロイが `code: 10181` で失敗する。
- **Worker のビルド設定の Root directory は `backend`。** ルートのままだと `wrangler.toml` が見つからず失敗する。
- `frontend` のビルドは `scripts/patch-admin-export.mjs` が Excel 出力用に `src/app/admin/page.tsx` を書き換えてから `next build` を走らせる。このスクリプトは冪等。
- Next.js のバージョンは破壊的変更を含むため、フロントを触る前に `frontend/AGENTS.md` を読むこと。

## セットアップ

メール送信機能の初期設定は [`backend/EMAIL_SETUP.md`](backend/EMAIL_SETUP.md) を参照。
