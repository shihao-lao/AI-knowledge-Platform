'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StatisticsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/knowledge-bases');
  }, [router]);

  return null;
}
