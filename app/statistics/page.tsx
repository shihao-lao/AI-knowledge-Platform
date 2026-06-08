'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StatisticsPage() {
    const router = useRouter();
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        if (countdown <= 0) {
            router.replace('/knowledge-bases');
            return;
        }
        const timer = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown, router]);

    return (
        <div>
            暂无数据库知识，{countdown}秒后跳转到知识库管理页面
        </div>
    );
}
