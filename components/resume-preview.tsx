'use client';

import { resumeSectionLines, resumeSections } from '@/lib/resume-layout';
import type { StructuredResume } from '@/types';
import './resume-workbench.css';

export default function ResumePreview({ value, style }: { value: StructuredResume; style: string }) {
  const basics = value.basics;
  return (
    <article className={`resume-paper resume-paper--${style}`} aria-label="简历实时预览">
      <header>
        {basics.name && <h1>{basics.name}</h1>}
        <p className="resume-paper-meta">
          {[basics.title, basics.phone, basics.email, basics.location, basics.website].filter(Boolean).join(' · ')}
        </p>
      </header>
      {resumeSections(value).map((section) => {
        const lines = resumeSectionLines(value, section.key);
        if (!lines.length) return null;
        return (
          <section key={section.key}>
            <h2>{section.title}</h2>
            {lines.map((line, index) => (
              <p key={index} className={`resume-paper-${line.kind}`}>
                {line.kind === 'bullet' ? `${style === 'compact' ? '-' : '•'} ` : ''}
                {line.text}
              </p>
            ))}
          </section>
        );
      })}
    </article>
  );
}
