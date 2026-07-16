'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div
        style={{
          maxWidth: '960px',
          margin: '16px auto 0',
          padding: '0 16px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <Link
          href="/admin"
          className={pathname === '/admin' ? 'btn btn-primary' : 'btn btn-outline'}
          style={{ width: 'auto', minWidth: '150px' }}
        >
          予約管理
        </Link>
        <Link
          href="/admin/email"
          className={pathname === '/admin/email' ? 'btn btn-primary' : 'btn btn-outline'}
          style={{ width: 'auto', minWidth: '180px' }}
        >
          メール自動送信設定
        </Link>
      </div>
      {children}
    </>
  );
}
