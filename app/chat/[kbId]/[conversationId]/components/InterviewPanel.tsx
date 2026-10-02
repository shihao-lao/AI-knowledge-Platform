'use client';

import {
  Alert,
  Button,
  Card,
  Collapse,
  Input,
  InputNumber,
  Progress,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { api, type ApiInterview } from '@/lib/api-client';

export default function InterviewPanel({ conversationId }: { conversationId: string }) {
  const [interview, setInterview] = useState<ApiInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<string | undefined>();
  const [category, setCategory] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getInterview(conversationId)
      .then(({ data }) => {
        if (!cancelled) setInterview(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const run = async (operation: () => Promise<{ data: ApiInterview }>) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await operation();
      setInterview(data);
      setAnswer('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
      // 响应丢失时重新读取服务端进度；同一题重试也不会重复计分。
      try {
        setInterview((await api.getInterview(conversationId)).data);
      } catch {
        /* 保留原进度和草稿 */
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="util-center-pad">
        <Spin tip="正在恢复面试进度" />
      </div>
    );
  const turn = interview?.turns[interview.currentPosition];
  const finished = interview?.turns.filter((item) => item.evaluation).length ?? 0;

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {error && <Alert type="error" showIcon message={error} />}
        {!interview ? (
          <Card title="开始模拟面试">
            <Typography.Paragraph>
              从当前知识库题库选题，逐题作答并评分。进度自动保存，可从历史对话继续。
            </Typography.Paragraph>
            <Space wrap>
              <InputNumber
                aria-label="题目数量"
                min={1}
                max={20}
                value={count}
                onChange={(value) => setCount(value ?? 5)}
                addonBefore="题数"
              />
              <Select
                aria-label="面试难度"
                allowClear
                placeholder="全部难度"
                style={{ width: 140 }}
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: 'easy', label: '简单' },
                  { value: 'medium', label: '中等' },
                  { value: 'hard', label: '困难' },
                ]}
              />
              <Input
                aria-label="题目分类"
                placeholder="分类（可选）"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: 180 }}
              />
              <Button
                type="primary"
                loading={busy}
                onClick={() =>
                  run(() => api.startInterview(conversationId, count, difficulty, category.trim() || undefined))
                }
              >
                开始面试
              </Button>
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
              不足指定题数时使用所有符合条件的题目。完成后可新建对话开始下一场。
            </Typography.Paragraph>
          </Card>
        ) : (
          <>
            <Progress
              percent={Math.round((finished / interview.turns.length) * 100)}
              format={() => `${finished} / ${interview.turns.length} 题已评分`}
            />
            {interview.status === 'completed' && interview.summary ? (
              <Card title="本场面试已完成">
                <Typography.Title level={3}>平均分：{interview.summary.averageScore} / 100</Typography.Title>
                <Typography.Paragraph>本场逐题成绩已计入练习统计。</Typography.Paragraph>
                <Typography.Paragraph>
                  建议复习：{interview.summary.keyPoints.join('；') || '暂无遗漏要点，继续巩固已学内容。'}
                </Typography.Paragraph>
              </Card>
            ) : (
              turn && (
                <Card title={`第 ${interview.currentPosition + 1} 题 / 共 ${interview.turns.length} 题`}>
                  <Tag>{turn.category}</Tag>
                  <Tag>
                    {({ easy: '简单', medium: '中等', hard: '困难' } as Record<string, string>)[turn.difficulty] ??
                      turn.difficulty}
                  </Tag>
                  <Typography.Paragraph strong style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>
                    {turn.question}
                  </Typography.Paragraph>
                  {turn.evaluation ? (
                    <>
                      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                        你的回答：{turn.userAnswer}
                      </Typography.Paragraph>
                      <Typography.Title level={4}>评分：{turn.evaluation.score} / 100</Typography.Title>
                      <Typography.Paragraph>{turn.evaluation.feedback}</Typography.Paragraph>
                      <Typography.Paragraph>
                        建议补充：{turn.evaluation.keyPoints.join('；') || '无'}
                      </Typography.Paragraph>
                      <Typography.Paragraph>参考要点：{turn.evaluation.referenceSummary}</Typography.Paragraph>
                      <Button
                        type="primary"
                        loading={busy}
                        onClick={() => run(() => api.nextInterviewQuestion(conversationId, turn.id))}
                      >
                        {interview.currentPosition + 1 === interview.turns.length ? '完成面试并查看总结' : '下一题'}
                      </Button>
                    </>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input.TextArea
                        aria-label="面试回答"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        autoSize={{ minRows: 6, maxRows: 15 }}
                        maxLength={20000}
                        showCount
                        disabled={busy}
                        placeholder="写下你的回答，提交后查看评分和参考要点"
                      />
                      <Button
                        type="primary"
                        loading={busy}
                        disabled={!answer.trim()}
                        onClick={() => run(() => api.answerInterview(conversationId, turn.id, answer.trim()))}
                      >
                        提交并评分
                      </Button>
                    </Space>
                  )}
                </Card>
              )
            )}
            <Collapse
              items={interview.turns
                .filter((item) => item.evaluation)
                .map((item) => ({
                  key: item.id,
                  label: `第 ${item.position + 1} 题 · ${item.evaluation?.score} 分 · ${item.question}`,
                  children: (
                    <>
                      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                        你的回答：{item.userAnswer}
                      </Typography.Paragraph>
                      <Typography.Paragraph>{item.evaluation?.feedback}</Typography.Paragraph>
                      <Typography.Paragraph>参考要点：{item.evaluation?.referenceSummary}</Typography.Paragraph>
                    </>
                  ),
                }))}
            />
          </>
        )}
      </Space>
    </div>
  );
}
