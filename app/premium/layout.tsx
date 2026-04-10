import type { ReactNode } from 'react';
import { PremiumModeGate } from '@/components/PremiumModeGate';

export default function PremiumLayout({ children }: { children: ReactNode }) {
  return <PremiumModeGate>{children}</PremiumModeGate>;
}
