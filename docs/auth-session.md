# 登录状态保持

登录令牌和与其绑定的用户资料保存到当前站点的 localStorage。刷新、关闭后重新打开同一站点时，通过 /auth/me 验证并恢复登录。网络错误或服务端 5xx 时，仅恢复尚未过期且绑定当前令牌的用户资料；业务接口仍由后端校验身份。401 清除本地登录。

后端 ACCESS_TOKEN_EXPIRE_MINUTES 默认 10080（7 天），可在 background/.env 调整。修改后需重启后端；已经发出的 15 分钟令牌不能延长，需要再登录一次。该实现是固定期限的 JWT 登录，不是滚动续期。

浏览器存储按站点隔离，请固定使用同一个地址；localhost 和 127.0.0.1 或不同端口不共享登录。

验证：node checks/auth-session-regression.mjs；npx tsc --noEmit；npx eslint lib/api-client.ts lib/hooks/use-auth.tsx。
