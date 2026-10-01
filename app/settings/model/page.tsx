'use client';

import { ApiOutlined, ExperimentOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Slider,
  Space,
  Typography,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/app-shell';
import { api, type LLMSettings, type LLMTestResult } from '@/lib/api-client';

interface ProviderPreset {
  value: string;
  label: string;
  baseUrl: string;
  model: string;
  hint?: string;
}

/**
 * 常见 OpenAI 兼容服务商。选择后会自动填入地址与默认模型，
 * 用户仍可手动改成任意中转或自建服务。
 */
const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    value: 'mimo',
    label: '小米 MiMo',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
  },
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    value: 'moonshot',
    label: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  {
    value: 'dashscope',
    label: '阿里云百炼（通义千问）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  {
    value: 'zhipu',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  {
    value: 'ollama',
    label: '本地 Ollama',
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    hint: '本地服务通常不校验密钥，API Key 随便填一个非空值即可（如 ollama）',
  },
  { value: 'custom', label: '自定义（任意 OpenAI 兼容服务）', baseUrl: '', model: '' },
];

interface FormValues {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

const FALLBACK_VALUES: FormValues = {
  provider: 'custom',
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 2048,
  timeout: 60,
};

export default function ModelSettingsPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [settings, setSettings] = useState<LLMSettings | null>(null);
  const [testResult, setTestResult] = useState<LLMTestResult | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  // 用 useWatch 让温度标签随滑块实时更新
  const temperature = Form.useWatch('temperature', form);

  const applySettings = useCallback(
    (data: LLMSettings) => {
      setSettings(data);
      form.setFieldsValue({
        provider: data.provider || 'custom',
        baseUrl: data.baseUrl || '',
        // 密钥不回填，留空即表示沿用已保存的那把
        apiKey: '',
        model: data.model || '',
        temperature: data.temperature ?? FALLBACK_VALUES.temperature,
        maxTokens: data.maxTokens ?? FALLBACK_VALUES.maxTokens,
        timeout: data.timeout ?? FALLBACK_VALUES.timeout,
      });
    },
    [form],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      applySettings(await api.getLLMSettings());
    } catch (err) {
      message.error(err instanceof Error ? err.message : '读取模型配置失败');
    } finally {
      setLoading(false);
    }
  }, [applySettings, message]);

  useEffect(() => {
    load();
  }, [load]);

  const handleProviderChange = (value: string) => {
    const preset = PROVIDER_PRESETS.find((item) => item.value === value);
    // 自定义服务保留用户已填写的地址与模型，不清空
    if (!preset || preset.value === 'custom') return;
    form.setFieldsValue({ provider: value, baseUrl: preset.baseUrl, model: preset.model });
    if (preset.hint) message.info(preset.hint);
  };

  const collectValues = async (): Promise<FormValues | null> => {
    try {
      return await form.validateFields();
    } catch {
      return null; // 校验失败，antd 已在表单项上展示错误
    }
  };

  const handleTest = async () => {
    const values = await collectValues();
    if (!values) return;

    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testLLMSettings({
        provider: values.provider,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey?.trim() || undefined,
        model: values.model.trim(),
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        timeout: values.timeout,
      });
      setTestResult(result);
      if (result.ok) message.success(result.message);
      else message.error(result.message);
    } catch (err) {
      const text = err instanceof Error ? err.message : '测试失败';
      setTestResult({ ok: false, message: text, latencyMs: 0, model: '', reply: '', modelsAvailable: 0 });
      message.error(text);
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    const baseUrl = (form.getFieldValue('baseUrl') as string | undefined)?.trim();
    const apiKey = (form.getFieldValue('apiKey') as string | undefined)?.trim();
    setFetchingModels(true);
    try {
      const result = await api.listLLMModels({ baseUrl, apiKey: apiKey || undefined });
      if (!result.ok) {
        message.warning(result.message || '未能获取模型列表');
        return;
      }
      setModelOptions(result.data);
      message.success(result.message || `获取到 ${result.data.length} 个模型`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '拉取模型列表失败');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleSave = async () => {
    const values = await collectValues();
    if (!values) return;

    setSaving(true);
    try {
      const saved = await api.saveLLMSettings({
        provider: values.provider,
        baseUrl: values.baseUrl.trim(),
        apiKey: values.apiKey?.trim() || undefined,
        model: values.model.trim(),
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        timeout: values.timeout,
      });
      applySettings(saved);
      setTestResult(null);
      message.success('模型配置已保存，AI 问答将使用该模型');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    modal.confirm({
      title: '恢复服务端默认配置？',
      content: '将删除你保存的模型配置，之后的 AI 请求会改用服务端 .env 中配置的默认模型。',
      okText: '恢复默认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          applySettings(await api.resetLLMSettings());
          setModelOptions([]);
          setTestResult(null);
          message.success('已恢复服务端默认配置');
        } catch (err) {
          message.error(err instanceof Error ? err.message : '恢复失败');
        }
      },
    });
  };

  const renderStatus = () => {
    if (!settings) return null;
    if (settings.source === 'user') {
      return (
        <Alert
          type="success"
          showIcon
          message="正在使用你自己配置的模型"
          description={`${settings.model} · ${settings.baseUrl}`}
        />
      );
    }
    if (settings.source === 'server') {
      return (
        <Alert
          type="info"
          showIcon
          message="当前使用服务端默认模型"
          description="服务端 .env 里已配置模型。保存下面的配置后，你的请求会优先使用自己的模型。"
        />
      );
    }
    return (
      <Alert
        type="warning"
        showIcon
        message="尚未配置任何模型"
        description="AI 问答、练习评分、简历分析、摘要生成都不可用。填写下面的配置并保存即可启用。"
      />
    );
  };

  return (
    <AppShell activeNav="">
      <main className="simple-page">
        <Card>
          <div className="util-page-header">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 0 }}>
                模型配置
              </Typography.Title>
              <Typography.Text type="secondary">接入任意 OpenAI 兼容服务，配置只属于你自己的账号</Typography.Text>
            </div>
            <Space>
              <Button icon={<ExperimentOutlined />} loading={testing} onClick={handleTest}>
                测试连接
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
                保存配置
              </Button>
              <Button danger icon={<ReloadOutlined />} onClick={handleReset}>
                恢复默认
              </Button>
            </Space>
          </div>

          <div className="util-stack util-stack-12" style={{ marginTop: 16 }}>
            {renderStatus()}

            {testResult && (
              <Alert
                type={testResult.ok ? 'success' : 'error'}
                showIcon
                message={testResult.message}
                description={
                  testResult.ok
                    ? `耗时 ${testResult.latencyMs} ms · 模型返回：${testResult.reply || '（空）'}`
                    : '请检查 Base URL、API Key 与模型名后重试'
                }
              />
            )}

            {loading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
              <Form form={form} layout="vertical" initialValues={FALLBACK_VALUES} style={{ maxWidth: 720 }}>
                <Form.Item label="服务商" name="provider">
                  <Select
                    onChange={handleProviderChange}
                    options={PROVIDER_PRESETS.map((item) => ({ value: item.value, label: item.label }))}
                  />
                </Form.Item>

                <Form.Item
                  label="API Base URL"
                  name="baseUrl"
                  rules={[
                    { required: true, message: '请填写 API Base URL' },
                    { pattern: /^https?:\/\//, message: '需以 http:// 或 https:// 开头' },
                  ]}
                  extra="OpenAI 兼容地址，一般以 /v1 结尾。自建或中转服务填自己的地址即可。"
                >
                  <Input prefix={<ApiOutlined />} placeholder="https://api.openai.com/v1" />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name="apiKey"
                  rules={settings?.apiKeySet ? [] : [{ required: true, message: '请填写 API Key' }]}
                >
                  <Input.Password
                    autoComplete="new-password"
                    placeholder={settings?.apiKeySet ? `已保存 ${settings.apiKeyMasked}，留空表示不修改` : 'sk-...'}
                  />
                </Form.Item>

                <Form.Item label="模型名称" required>
                  <Space.Compact style={{ width: '100%' }}>
                    <Form.Item name="model" noStyle rules={[{ required: true, message: '请填写模型名称' }]}>
                      <AutoComplete
                        style={{ width: '100%' }}
                        placeholder="例如：gpt-4o-mini"
                        options={modelOptions.map((item) => ({ value: item }))}
                      />
                    </Form.Item>
                    <Button loading={fetchingModels} onClick={handleFetchModels}>
                      拉取模型列表
                    </Button>
                  </Space.Compact>
                </Form.Item>

                <Form.Item
                  label={`温度（temperature）：${temperature ?? FALLBACK_VALUES.temperature}`}
                  name="temperature"
                  extra="越低越稳定严谨，越高越发散有创意"
                >
                  <Slider min={0} max={2} step={0.1} />
                </Form.Item>

                <Form.Item label="最大输出 tokens" name="maxTokens">
                  <InputNumber min={1} max={131072} step={256} style={{ width: 200 }} />
                </Form.Item>

                <Form.Item label="请求超时（秒）" name="timeout">
                  <InputNumber min={5} max={600} step={5} style={{ width: 200 }} />
                </Form.Item>

                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  API Key 只保存在服务端数据库中，接口返回时始终脱敏；换回服务端默认配置会删除你保存的密钥。
                </Typography.Paragraph>
              </Form>
            )}
          </div>
        </Card>
      </main>
    </AppShell>
  );
}
