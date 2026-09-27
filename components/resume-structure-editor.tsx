'use client';

import { Alert, Button, Collapse, Form, Input, Popconfirm, Segmented, Select, Space, Typography } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { StructuredResume } from '@/types';
import { emptyStructuredResume } from '@/types';
import { resumeSections } from '@/lib/resume-layout';
import ResumePreview from '@/components/resume-preview';

const inputProps = { allowClear: true as const };

export type ExportStyle = 'classic' | 'compact' | 'modern';

const STYLE_OPTIONS = [
  { label: '经典简洁', value: 'classic' as const },
  { label: '紧凑排版', value: 'compact' as const },
  { label: '现代强调', value: 'modern' as const },
];

interface Props {
  value: StructuredResume;
  saving: boolean;
  onChange: (next: StructuredResume) => void;
  onSave: () => void;
  onReparse: () => void;
  onExport: (format: 'pdf' | 'docx', style: ExportStyle) => void;
  dirty: boolean;
  resetKey: string;
  onDiscard: () => void;
  exportStyle: ExportStyle;
  onStyleChange: (style: ExportStyle) => void;
}

function BulletListField({ parentName }: { parentName: number }) {
  return (
    <Form.List name={[parentName, 'bullets']}>
      {(fields, { add, remove }) => (
        <div className="resume-field-stack">
          {fields.map((field) => (
            <Space key={field.key} align="start" className="resume-bullet-row">
              <Form.Item name={field.name} noStyle>
                <Input.TextArea rows={2} placeholder="要点描述（动词开头，尽量量化）" />
              </Form.Item>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
            </Space>
          ))}
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add('')}>
            添加要点
          </Button>
        </div>
      )}
    </Form.List>
  );
}

export default function ResumeStructureEditor({
  value,
  saving,
  onChange,
  onSave,
  onReparse,
  onExport,
  dirty,
  resetKey,
  onDiscard,
  exportStyle,
  onStyleChange,
}: Props) {
  const [form] = Form.useForm();

  const handleValuesChange = (_: unknown, all: StructuredResume) => {
    const next = { ...emptyStructuredResume(), ...value, ...all, basics: { ...value.basics, ...all.basics } };
    const customIds = new Set(next.customSections.map((section) => section.id));
    next.layout = {
      sections: value.layout.sections
        .filter((section) => !section.key.startsWith('custom-') || customIds.has(section.key))
        .map((section) => ({
          ...section,
          title: next.customSections.find((custom) => custom.id === section.key)?.title ?? section.title,
        })),
    };
    onChange(next);
  };
  const sections = resumeSections(value);
  const moveSection = (index: number, direction: -1 | 1) => {
    const next = [...sections];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange({ ...value, layout: { sections: next } });
  };

  return (
    <div className="resume-editor">
      <div className="resume-editor-toolbar">
        <Space wrap>
          <Button type="primary" icon={<SaveOutlined />} onClick={onSave} loading={saving} disabled={!dirty}>
            保存修改
          </Button>
          <Popconfirm
            title="重新解析会覆盖当前已保存的编辑内容"
            description="将重新从上传时的原文填充，确定继续吗？"
            onConfirm={onReparse}
            disabled={saving || dirty}
            okText="重新解析"
            cancelText="取消"
          >
            <Button icon={<ReloadOutlined />} disabled={saving || dirty}>
              重新解析
            </Button>
          </Popconfirm>
          {dirty && (
            <Button onClick={onDiscard} disabled={saving}>
              撤销未保存修改
            </Button>
          )}
        </Space>
        {dirty ? (
          <Typography.Text type="warning" style={{ fontSize: 12 }}>
            有未保存修改
          </Typography.Text>
        ) : null}
      </div>

      <div className="resume-export-bar">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          导出样式
        </Typography.Text>
        <Segmented
          size="small"
          value={exportStyle}
          onChange={(v) => onStyleChange(v as ExportStyle)}
          disabled={saving}
          options={STYLE_OPTIONS}
        />
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => onExport('pdf', exportStyle)} disabled={saving}>
            导出 PDF
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => onExport('docx', exportStyle)} disabled={saving}>
            导出 Word
          </Button>
        </Space>
      </div>

      <Alert
        className="resume-workbench-note"
        type="info"
        showIcon
        message="保留原栏目与内容，统一排版"
        description="可调整栏目名称、顺序和内容。导出时自动保存修改；请结合原文对照检查识别结果。右侧为内容预览，文件分页以导出结果为准。"
      />
      <div className="resume-workbench">
        <div>
          <Collapse
            className="resume-workbench-note"
            items={[
              {
                key: 'layout',
                label: '栏目名称与顺序',
                children: (
                  <div className="resume-field-stack">
                    {sections.map((section, index) => (
                      <div className="resume-layout-row" key={section.key}>
                        <Input
                          aria-label={`栏目名称 ${section.title}`}
                          value={section.title}
                          disabled={saving}
                          onChange={(event) => {
                            const title = event.target.value;
                            const customSections = value.customSections.map((custom) =>
                              custom.id === section.key ? { ...custom, title } : custom,
                            );
                            form.setFieldValue('customSections', customSections);
                            onChange({
                              ...value,
                              customSections,
                              layout: {
                                sections: sections.map((item) =>
                                  item.key === section.key ? { ...item, title } : item,
                                ),
                              },
                            });
                          }}
                        />
                        <Button
                          aria-label={`上移 ${section.title}`}
                          icon={<ArrowUpOutlined />}
                          disabled={saving || index === 0}
                          onClick={() => moveSection(index, -1)}
                        />
                        <Button
                          aria-label={`下移 ${section.title}`}
                          icon={<ArrowDownOutlined />}
                          disabled={saving || index === sections.length - 1}
                          onClick={() => moveSection(index, 1)}
                        />
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
          <Form
            form={form}
            layout="vertical"
            size="small"
            initialValues={value}
            onValuesChange={handleValuesChange}
            key={resetKey}
            disabled={saving}
          >
            <Collapse
              defaultActiveKey={['basics', 'experience', 'projects']}
              className="resume-editor-collapse"
              items={[
                {
                  key: 'basics',
                  label: '基本信息',
                  children: (
                    <>
                      <div className="resume-grid-2">
                        <Form.Item name={['basics', 'name']} label="姓名">
                          <Input {...inputProps} />
                        </Form.Item>
                        <Form.Item name={['basics', 'title']} label="职位 / 头衔">
                          <Input {...inputProps} />
                        </Form.Item>
                        <Form.Item name={['basics', 'email']} label="邮箱">
                          <Input {...inputProps} />
                        </Form.Item>
                        <Form.Item name={['basics', 'phone']} label="电话">
                          <Input {...inputProps} />
                        </Form.Item>
                        <Form.Item name={['basics', 'location']} label="城市">
                          <Input {...inputProps} />
                        </Form.Item>
                        <Form.Item name={['basics', 'website']} label="主页 / GitHub">
                          <Input {...inputProps} />
                        </Form.Item>
                      </div>
                      <Form.Item name={['basics', 'summary']} label="个人简介">
                        <Input.TextArea rows={4} placeholder="3-5 句：定位、核心优势、目标岗位" />
                      </Form.Item>
                    </>
                  ),
                },
                {
                  key: 'education',
                  label: `教育背景（${value.education.length}）`,
                  children: (
                    <Form.List name="education">
                      {(fields, { add, remove }) => (
                        <div className="resume-field-stack">
                          {fields.map((field) => (
                            <div key={field.key} className="resume-item-card">
                              <div className="resume-item-head">
                                <Typography.Text type="secondary">教育 {field.name + 1}</Typography.Text>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                />
                              </div>
                              <div className="resume-grid-2">
                                <Form.Item name={[field.name, 'school']} label="学校">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'degree']} label="学历">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'major']} label="专业">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'start']} label="开始">
                                  <Input {...inputProps} placeholder="YYYY-MM" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'end']} label="结束">
                                  <Input {...inputProps} placeholder="YYYY-MM" />
                                </Form.Item>
                              </div>
                              <Form.Item name={[field.name, 'description']} label="描述">
                                <Input.TextArea rows={2} />
                              </Form.Item>
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() =>
                              add({ school: '', degree: '', major: '', start: '', end: '', description: '' })
                            }
                          >
                            添加教育经历
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  ),
                },
                {
                  key: 'experience',
                  label: `工作经历（${value.experience.length}）`,
                  children: (
                    <Form.List name="experience">
                      {(fields, { add, remove }) => (
                        <div className="resume-field-stack">
                          {fields.map((field) => (
                            <div key={field.key} className="resume-item-card">
                              <div className="resume-item-head">
                                <Typography.Text type="secondary">工作 {field.name + 1}</Typography.Text>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                />
                              </div>
                              <div className="resume-grid-2">
                                <Form.Item name={[field.name, 'company']} label="公司">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'title']} label="职位">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'location']} label="地点">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'start']} label="开始">
                                  <Input {...inputProps} placeholder="YYYY-MM" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'end']} label="结束">
                                  <Input {...inputProps} placeholder="YYYY-MM 或 至今" />
                                </Form.Item>
                              </div>
                              <Form.Item label="工作要点" required={false}>
                                <BulletListField parentName={field.name} />
                              </Form.Item>
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() =>
                              add({ company: '', title: '', location: '', start: '', end: '', bullets: [''] })
                            }
                          >
                            添加工作经历
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  ),
                },
                {
                  key: 'projects',
                  label: `项目经历（${value.projects.length}）`,
                  children: (
                    <Form.List name="projects">
                      {(fields, { add, remove }) => (
                        <div className="resume-field-stack">
                          {fields.map((field) => (
                            <div key={field.key} className="resume-item-card">
                              <div className="resume-item-head">
                                <Typography.Text type="secondary">项目 {field.name + 1}</Typography.Text>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                />
                              </div>
                              <div className="resume-grid-2">
                                <Form.Item name={[field.name, 'name']} label="项目名">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'role']} label="角色">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'start']} label="开始">
                                  <Input {...inputProps} placeholder="YYYY-MM" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'end']} label="结束">
                                  <Input {...inputProps} placeholder="YYYY-MM" />
                                </Form.Item>
                              </div>
                              <Form.Item name={[field.name, 'description']} label="简介">
                                <Input.TextArea rows={2} />
                              </Form.Item>
                              <Form.Item label="项目要点" required={false}>
                                <BulletListField parentName={field.name} />
                              </Form.Item>
                              <Form.Item name={[field.name, 'tech']} label="技术栈（逗号分隔）">
                                <Select
                                  mode="tags"
                                  tokenSeparators={[',', '，', '、', ';', '；']}
                                  placeholder="输入技术后按回车添加"
                                />
                              </Form.Item>
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() =>
                              add({ name: '', role: '', start: '', end: '', description: '', bullets: [''], tech: [] })
                            }
                          >
                            添加项目
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  ),
                },
                {
                  key: 'skills',
                  label: `技能（${value.skills.length}）`,
                  children: (
                    <Form.List name="skills">
                      {(fields, { add, remove }) => (
                        <div className="resume-field-stack">
                          {fields.map((field) => (
                            <div key={field.key} className="resume-item-card">
                              <div className="resume-item-head">
                                <Typography.Text type="secondary">技能组 {field.name + 1}</Typography.Text>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                />
                              </div>
                              <Form.Item name={[field.name, 'category']} label="分类">
                                <Input {...inputProps} placeholder="如：后端 / 前端 / 工具" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'items']} label="技能项（逗号分隔）">
                                <Select
                                  mode="tags"
                                  tokenSeparators={[',', '，', '、', ';', '；']}
                                  placeholder="输入技能后按回车添加"
                                />
                              </Form.Item>
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => add({ category: '', items: [] })}
                          >
                            添加技能组
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  ),
                },
                {
                  key: 'customSections',
                  label: `自定义栏目（${value.customSections.length}）`,
                  children: (
                    <Form.List name="customSections">
                      {(fields, { add, remove }) => (
                        <div className="resume-field-stack">
                          {fields.map((field) => (
                            <div className="resume-item-card" key={field.key}>
                              <div className="resume-item-head">
                                <Typography.Text>自定义栏目 {field.name + 1}</Typography.Text>
                                <Button
                                  aria-label={`删除自定义栏目 ${field.name + 1}`}
                                  type="text"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                />
                              </div>
                              <Form.Item name={[field.name, 'id']} hidden>
                                <Input />
                              </Form.Item>
                              <Form.Item name={[field.name, 'title']} label="栏目名称">
                                <Input placeholder="例如：开源贡献、校园活动" />
                              </Form.Item>
                              <Form.Item name={[field.name, 'content']} label="栏目内容">
                                <Input.TextArea rows={5} />
                              </Form.Item>
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => add({ id: `custom-${crypto.randomUUID()}`, title: '新增栏目', content: '' })}
                          >
                            添加自定义栏目
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  ),
                },
                {
                  key: 'certifications',
                  label: `证书与奖项（${value.certifications.length}）`,
                  children: (
                    <Form.List name="certifications">
                      {(fields, { add, remove }) => (
                        <div className="resume-field-stack">
                          {fields.map((field) => (
                            <div key={field.key} className="resume-item-card">
                              <div className="resume-item-head">
                                <Typography.Text type="secondary">条目 {field.name + 1}</Typography.Text>
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => remove(field.name)}
                                />
                              </div>
                              <div className="resume-grid-2">
                                <Form.Item name={[field.name, 'name']} label="名称">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'issuer']} label="颁发方">
                                  <Input {...inputProps} />
                                </Form.Item>
                                <Form.Item name={[field.name, 'date']} label="时间">
                                  <Input {...inputProps} placeholder="YYYY-MM" />
                                </Form.Item>
                              </div>
                              <Form.Item name={[field.name, 'description']} label="说明">
                                <Input.TextArea rows={2} />
                              </Form.Item>
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            onClick={() => add({ name: '', issuer: '', date: '', description: '' })}
                          >
                            添加证书 / 奖项
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  ),
                },
              ]
                .map((item) => {
                  const section = sections.find((section) => section.key === item.key);
                  return section ? { ...item, label: section.title } : item;
                })
                .sort((a, b) => {
                  const rank = (key: string) =>
                    key === 'basics'
                      ? -1
                      : key === 'customSections'
                        ? sections.length
                        : sections.findIndex((section) => section.key === key);
                  return rank(a.key) - rank(b.key);
                })}
            />
          </Form>
        </div>
        <aside className="resume-workbench-preview">
          <Typography.Title level={5}>实时预览</Typography.Title>
          <ResumePreview value={value} style={exportStyle} />
        </aside>
      </div>
    </div>
  );
}
