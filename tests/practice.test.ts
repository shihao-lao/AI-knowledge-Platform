import { describe, it, expect } from 'vitest';
import { parseEvaluation } from '@/lib/server/practice-service';

describe('parseEvaluation 评估输出解析', () => {
  it('解析标准 JSON', () => {
    const result = parseEvaluation(
      '{"score": 85, "feedback": "整体不错", "keyPoints": ["缺例子"], "referenceSummary": "要点概括"}',
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBe(85);
    expect(result!.feedback).toBe('整体不错');
    expect(result!.keyPoints).toEqual(['缺例子']);
  });

  it('容忍代码块包裹', () => {
    const result = parseEvaluation('```json\n{"score": 70, "feedback": "还行", "keyPoints": [], "referenceSummary": ""}\n```');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(70);
  });

  it('容忍前后杂文本', () => {
    const result = parseEvaluation('好的，评估如下：{"score": 92, "feedback": "优秀", "keyPoints": ["无"], "referenceSummary": "覆盖全面"} 完毕');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(92);
  });

  it('分数越界收敛到 0-100', () => {
    expect(parseEvaluation('{"score": 150, "feedback": "x", "keyPoints": [], "referenceSummary": ""}')!.score).toBe(100);
    expect(parseEvaluation('{"score": -5, "feedback": "x", "keyPoints": [], "referenceSummary": ""}')!.score).toBe(0);
  });

  it('无 JSON 返回 null', () => {
    expect(parseEvaluation('抱歉，我无法评估')).toBeNull();
    expect(parseEvaluation('')).toBeNull();
  });
});
