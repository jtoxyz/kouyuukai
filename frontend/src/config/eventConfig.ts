// Event Configuration for Frontend

export const EVENT_CONFIG = {
  // Backend API URL (empty = same-origin via Next.js rewrites; set NEXT_PUBLIC_API_URL to override)
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  
  // Default fallback values if API is unavailable
  title: "大阪産業大学\n♪ホームカミングデー♪\n付属高校吹奏部演奏会",
  introTitleLines: ["ホームカミングデー", "スペシャルコンサート♪"],
  introText: "心に響く音楽を、ぜひ会場でお楽しみください！",
  date: "2026年10月31日（土）",
  time: "13:30開場／14:00開演",
  // 会報が変更前の時間で印刷されてしまったため、正しい時間のすぐ下と注意事項の先頭で変更を知らせる。
  // 日本語は単語区切りが無く任意の位置で折り返されるので、文節ごとに分けて渡す。
  // 各文節を inline-block で包み、文節の途中では改行させない。
  timeNotice: ["※上記の時間に", "開場・開演時間が", "変更になりました。"],
  // 注意事項は幅に余裕があるので文節分割せず、通常どおり行を詰めて折り返させる。
  timeChangeNote: "開場・開演時間が当初のご案内から変更されています。お間違いのないようご注意ください。",
  location: "大阪産業大学 本館1階 多目的ホール",

  notes: [
    "1回の予約で4名様までお申し込みいただけます。",
    "当日は受付場所に設置されたQRコードを読み取り、この端末で予約内容を表示してください。",
    "席は自由席になっています。",
    "予約が合計200名に達した場合、受付を終了します。"
  ],
  
  privacyStatement: `ご入力いただいた氏名などの個人情報は、本イベントの予約管理および当日の運営の目的にのみ使用し、それ以外の目的には使用いたしません。`
};
