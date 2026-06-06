export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * 联网搜索（使用 Bing 搜索，无需 API key，国内可访问）
 */
export async function webSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  try {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error('[WebSearch] HTTP error:', response.status);
      return [];
    }

    const html = await response.text();
    return parseBingResults(html, maxResults);
  } catch (err) {
    console.error('[WebSearch] search failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

function parseBingResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // 提取所有 <h2> 中的链接（Bing 搜索结果标题在 h2 标签内）
  const h2Matches = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) || [];

  for (const h2 of h2Matches) {
    if (results.length >= maxResults) break;

    const hrefMatch = h2.match(/href="([^"]*)"/);
    const titleMatch = h2.match(/<a[^>]*>([\s\S]*?)<\/a>/);

    if (hrefMatch && titleMatch) {
      const title = stripHtml(titleMatch[1]);
      const url = hrefMatch[1].replace(/&amp;/g, '&');

      // 跳过 Bing 内部链接
      if (url.includes('bing.com') || url.includes('microsoft.com/zh-cn/edge')) continue;
      if (!title) continue;

      // 查找对应的摘要：在 h2 后面的 <p> 或 <div class="b_caption"> 中
      const h2Idx = html.indexOf(h2);
      const afterH2 = html.slice(h2Idx + h2.length, h2Idx + h2.length + 1000);
      const snippetMatch = afterH2.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : '';

      results.push({ title, url, snippet });
    }
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#183;/g, '·')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 将搜索结果格式化为 LLM 上下文
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';
  return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
}
