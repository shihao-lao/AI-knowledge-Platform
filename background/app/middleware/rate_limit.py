# -*- coding: utf-8 -*-
"""速率限制中间件。"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Dict, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """基于 IP 的速率限制中间件。"""
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        # 存储请求记录：{ip: [(timestamp, count), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
    
    def _get_client_ip(self, request: Request) -> str:
        """获取客户端 IP 地址。"""
        # 优先从代理头获取真实 IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def _clean_old_requests(self, ip: str, current_time: float):
        """清理过期的请求记录。"""
        # 清理超过 1 小时的记录
        self.requests[ip] = [
            (ts, count) for ts, count in self.requests[ip]
            if current_time - ts < 3600
        ]
    
    def _check_rate_limit(self, ip: str) -> Tuple[bool, str]:
        """检查是否超过速率限制。"""
        current_time = time.time()
        self._clean_old_requests(ip, current_time)
        
        # 检查每分钟限制
        minute_ago = current_time - 60
        minute_requests = sum(
            count for ts, count in self.requests[ip]
            if ts > minute_ago
        )
        
        if minute_requests >= self.requests_per_minute:
            return False, f"每分钟请求次数超过限制（{self.requests_per_minute}次）"
        
        # 检查每小时限制
        hour_ago = current_time - 3600
        hour_requests = sum(
            count for ts, count in self.requests[ip]
            if ts > hour_ago
        )
        
        if hour_requests >= self.requests_per_hour:
            return False, f"每小时请求次数超过限制（{self.requests_per_hour}次）"
        
        return True, ""
    
    def _record_request(self, ip: str):
        """记录请求。"""
        current_time = time.time()
        self.requests[ip].append((current_time, 1))
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """处理请求。"""
        # 跳过健康检查端点
        if request.url.path.endswith("/health"):
            return await call_next(request)
        
        ip = self._get_client_ip(request)
        
        # 检查速率限制
        allowed, message = self._check_rate_limit(ip)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"error": "请求过于频繁", "detail": message},
            )
        
        # 记录请求
        self._record_request(ip)
        
        # 处理请求
        response = await call_next(request)
        
        # 添加速率限制头
        current_time = time.time()
        minute_ago = current_time - 60
        minute_requests = sum(
            count for ts, count in self.requests[ip]
            if ts > minute_ago
        )
        
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_minute - minute_requests)
        )
        
        return response