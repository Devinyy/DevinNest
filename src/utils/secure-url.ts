/**
 * 把后端返回的不安全图片地址升级为 https，消除 https 页面的"混合内容"(不安全)警告。
 *
 * 背景(2026-05)：后端对静态资源返回 `http://devinnest-api.top/...`（实测 http 还会 403），
 * 而实际可用地址是 `https://devinnest-api.top:8443/...`（实测 200）。
 * 本函数仅改写该主机的 http 地址；已是 https 的地址原样返回（幂等）。
 * 后端日后改为返回 https 地址后，此函数自动变为 no-op，可安全保留。
 */
export function secureUrl(u?: string | null): string {
  if (!u) return u || "";
  return u.replace(/^http:\/\/devinnest-api\.top(?::\d+)?/i, "https://devinnest-api.top:8443");
}
