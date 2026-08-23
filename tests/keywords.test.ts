import { describe, it, expect } from 'vitest';
import { extractKeywords, keywordMatchScore } from '@/lib/lancedb/keywords';

describe('extractKeywords 中文关键词提取', () => {
  it('提取中文词组并过滤停用词', () => {
    const kws = extractKeywords('什么是事件循环机制');
    expect(kws.length).toBeGreaterThan(0);
    expect(kws).toContain('事件');
    expect(kws).toContain('循环');
    expect(kws).not.toContain('什么'); // 停用词
    expect(kws).not.toContain('是'); // 停用词
  });

  it('保留英文关键词', () => {
    const kws = extractKeywords('Event Loop in JavaScript');
    expect(kws).toContain('event');
    expect(kws).toContain('loop');
    expect(kws).toContain('javascript');
  });

  it('单字重建 bigram：监控 → 监控', () => {
    const kws = extractKeywords('监控');
    expect(kws).toContain('监控');
  });

  it('纯停用词查询不保留单个停用词', () => {
    const kws = extractKeywords('的 了 是');
    // 停用词本身被过滤（bigram 重建可能产出词组，属预期行为）
    expect(kws).not.toContain('的');
    expect(kws).not.toContain('了');
    expect(kws).not.toContain('是');
    expect(extractKeywords('')).toEqual([]);
  });
});

describe('keywordMatchScore 关键词匹配分', () => {
  it('命中比例计算', () => {
    const score = keywordMatchScore('事件循环是 JavaScript 的核心机制', ['事件', '循环', '闭包']);
    expect(score).toBeCloseTo(2 / 3);
  });

  it('无关键词返回 0', () => {
    expect(keywordMatchScore('任意文本', [])).toBe(0);
  });

  it('完全不命中返回 0', () => {
    expect(keywordMatchScore('咖啡烘焙', ['事件循环'])).toBe(0);
  });
});
