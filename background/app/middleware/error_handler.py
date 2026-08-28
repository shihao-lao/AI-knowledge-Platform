# -*- coding: utf-8 -*-
"""错误处理中间件。"""

from __future__ import annotations

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """统一错误处理中间件。"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """处理请求。"""
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            # 记录错误
            import traceback
            traceback.print_exc()
            
            # 返回统一错误格式
            return JSONResponse(
                status_code=500,
                content={"error": "服务器内部错误", "detail": str(exc)},
            )