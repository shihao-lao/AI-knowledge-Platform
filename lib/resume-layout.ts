import { emptyStructuredResume, type StructuredResume } from '@/types';

export const RESUME_SECTION_TITLES: Record<string, string> = {
  summary: '个人简介',
  education: '教育背景',
  experience: '工作经历',
  projects: '项目经历',
  skills: '专业技能',
  certifications: '证书与奖项',
};

export function normalizeStructuredResume(raw: unknown): StructuredResume {
  const base = emptyStructuredResume();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<StructuredResume>;
  return {
    ...base,
    basics: { ...base.basics, ...data.basics },
    education: Array.isArray(data.education) ? data.education : [],
    experience: Array.isArray(data.experience) ? data.experience : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    skills: Array.isArray(data.skills) ? data.skills : [],
    certifications: Array.isArray(data.certifications) ? data.certifications : [],
    customSections: Array.isArray(data.customSections) ? data.customSections : [],
    layout: { sections: Array.isArray(data.layout?.sections) ? data.layout.sections : [] },
  };
}

export function resumeSections(data: StructuredResume) {
  const titles = { ...RESUME_SECTION_TITLES };
  for (const section of data.customSections) titles[section.id] = section.title || '补充内容';
  const result: Array<{ key: string; title: string }> = [];
  const seen = new Set<string>();
  for (const section of [...data.layout.sections, ...Object.keys(titles).map((key) => ({ key, title: titles[key] }))]) {
    if (!(section.key in titles) || seen.has(section.key)) continue;
    seen.add(section.key);
    result.push({ key: section.key, title: section.title || titles[section.key] });
  }
  return result;
}

export type ResumeLine = { kind: 'sub' | 'text' | 'bullet' | 'meta'; text: string };

export function resumeSectionLines(data: StructuredResume, key: string): ResumeLine[] {
  const lines: ResumeLine[] = [];
  const add = (kind: ResumeLine['kind'], ...parts: string[]) => {
    const text = parts.filter(Boolean).join(' · ');
    if (text.trim()) lines.push({ kind, text });
  };
  const period = (start: string, end: string) => [start, end].filter(Boolean).join(' — ');
  switch (key) {
    case 'summary':
      add('text', data.basics.summary);
      break;
    case 'education':
      for (const item of data.education) {
        add('sub', item.school, item.degree, item.major, period(item.start, item.end));
        add('text', item.description);
      }
      break;
    case 'experience':
      for (const item of data.experience) {
        add('sub', item.company, item.title, item.location, period(item.start, item.end));
        for (const bullet of item.bullets || []) add('bullet', bullet);
      }
      break;
    case 'projects':
      for (const item of data.projects) {
        add('sub', item.name, item.role, period(item.start, item.end));
        add('text', item.description);
        for (const bullet of item.bullets || []) add('bullet', bullet);
        if (item.tech?.length) add('meta', `技术栈：${item.tech.join(', ')}`);
      }
      break;
    case 'skills':
      for (const item of data.skills) {
        if (item.items?.length) add('text', `${item.category || '技能'}：${item.items.join(', ')}`);
      }
      break;
    case 'certifications':
      for (const item of data.certifications) {
        add('sub', item.name, item.issuer, item.date);
        add('text', item.description);
      }
      break;
    default: {
      const item = data.customSections.find((section) => section.id === key);
      if (item) add('text', item.content);
    }
  }
  return lines;
}
