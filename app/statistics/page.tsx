'use client';

import { useEffect } from 'react';
import { useNavigation } from '@/lib/hooks/use-navigation';

export default function StatisticsPage() {
  const { goToKnowledgeBase } = useNavigation();

  useEffect(() => {
    goToKnowledgeBase();
  }, [goToKnowledgeBase]);

  return null;
}
