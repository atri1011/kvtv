'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePremiumModeEnabled } from '@/lib/hooks/usePremiumModeEnabled';

export function PremiumModeGate({ children }: { children: ReactNode }) {
  const premiumModeEnabled = usePremiumModeEnabled();

  if (premiumModeEnabled) {
    return <>{children}</>;
  }

  return (
    <div className='min-h-screen bg-black text-white'>
      <div className='mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center'>
        <div className='rounded-[var(--radius-2xl)] border border-white/10 bg-white/5 p-8 shadow-[var(--shadow-md)] backdrop-blur-xl'>
          <h1 className='text-2xl font-bold'>高级模式未开启</h1>
          <p className='mt-3 text-sm text-white/70'>
            请先到普通设置页开启高级模式，开启后首页会显示入口，并允许访问高级页面。
          </p>
          <div className='mt-6 flex flex-wrap justify-center gap-3'>
            <Link
              href='/settings'
              className='rounded-[var(--radius-2xl)] bg-[var(--accent-color)] px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90'
            >
              前往设置
            </Link>
            <Link
              href='/'
              className='rounded-[var(--radius-2xl)] border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10'
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
