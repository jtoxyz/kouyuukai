// Event Configuration for Frontend

export const EVENT_CONFIG = {
  // Backend API URL (empty = same-origin via Next.js rewrites; set NEXT_PUBLIC_API_URL to override)
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  
  // Default fallback values if API is unavailable
  title: "大阪産業大学ホームカミングデー\n付属高校吹奏部演奏会",
  intro: "ホームカミングデースペシャルコンサート♪\n心に響く音楽を、ぜひ会場でお楽しみください！",
  date: "2026年10月25日(日) 13:30開場 / 14:00開演",
  location: "大阪産業大学附属高等学校 講堂",
  
  notes: [
    "1回の予約で2名様までお申し込みいただけます。",
    "当日は受付場所に設置されたQRコードを読み取り、この端末で予約内容を表示してください。",
    "席は自由席になっています。",
    "予約が合計200名に達した場合、受付を終了します。"
  ],
  
  privacyStatement: `ご入力いただいた氏名などの個人情報は、本イベントの予約管理および当日の運営の目的にのみ使用し、それ以外の目的には使用いたしません。

また、個人情報は『個人情報の保護に関する法律』および関連法令に基づき、適切に管理いたします。`
};