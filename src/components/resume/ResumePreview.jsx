import { TEMPLATES } from './resumeTemplates';

function fmt(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${y}`;
}

function DateRange({ start, end, current }) {
  if (!start && !end) return null;
  return (
    <span className="text-xs text-gray-600 whitespace-nowrap">
      {fmt(start)}{(start || current || end) && (end || current) ? ' – ' : ''}{current ? 'Present' : fmt(end)}
    </span>
  );
}

function ContactSection({ contact, accentColor }) {
  if (!contact) return null;
  const parts = [contact.email, contact.phone, contact.linkedin, contact.github, contact.portfolio, contact.location]
    .filter(Boolean);
  return (
    <div className="text-center mb-4 pb-3" style={{ borderBottom: `2px solid ${accentColor}` }}>
      {contact.name && (
        <h1 className="text-2xl font-bold tracking-wide" style={{ color: accentColor, fontFamily: 'Georgia, serif' }}>
          {contact.name}
        </h1>
      )}
      {parts.length > 0 && (
        <p className="text-xs text-gray-600 mt-1 flex flex-wrap justify-center gap-x-2 gap-y-0.5">
          {parts.map((p, i) => (
            <span key={i}>
              {p.startsWith('http') || p.includes('linkedin') || p.includes('github')
                ? <a href={p.startsWith('http') ? p : `https://${p}`} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{p}</a>
                : p}
              {i < parts.length - 1 && <span className="mx-1 text-gray-300">|</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function SkillsSection({ section, data }) {
  const skills = data?.skills || [];
  if (skills.length === 0 && data?.text) {
    return (
      <div className="mb-4">
        <SectionHeading label={section.label} accentColor="#374151" />
        <p className="text-xs text-gray-700">{data.text}</p>
      </div>
    );
  }
  if (skills.length === 0) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor="#374151" />
      <p className="text-xs text-gray-700 leading-relaxed">{skills.join(' · ')}</p>
    </div>
  );
}

function SectionHeading({ label, accentColor }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: accentColor, fontFamily: 'Georgia, serif' }}>
        {label}
      </h2>
      <div className="flex-1 h-px" style={{ background: accentColor, opacity: 0.4 }} />
    </div>
  );
}

function ListSection({ section, entries, accentColor }) {
  const visible = (entries || []).filter(e => !e.hidden);
  if (visible.length === 0) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor} />
      <div className="space-y-2">
        {visible.map(entry => (
          <div key={entry.id}>
            <div className="flex justify-between items-baseline gap-2">
              <div>
                {entry.title && <span className="text-xs font-bold text-gray-900">{entry.title}</span>}
                {entry.title && entry.org && <span className="text-xs text-gray-600">, </span>}
                {entry.org && <span className="text-xs font-semibold text-gray-700">{entry.org}</span>}
              </div>
              <DateRange start={entry.startDate} end={entry.endDate} current={entry.current} />
            </div>
            {entry.location && <p className="text-[10px] text-gray-500 italic">{entry.location}</p>}
            {entry.bullets?.filter(b => b.trim()).length > 0 && (
              <ul className="mt-0.5 ml-4 list-disc space-y-0.5">
                {entry.bullets.filter(b => b.trim()).map((b, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-relaxed">{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResumePreview({ resume, forExport = false }) {
  const template = TEMPLATES.find(t => t.id === resume?.template_id) || TEMPLATES[5];
  const accentColor = template.accentColor;
  const content = resume?.content || {};
  const sectionOrder = resume?.section_order || [];

  // Build ordered section list
  const allSections = content.sections || [];
  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => allSections.find(s => s.id === id)).filter(Boolean),
       ...allSections.filter(s => !sectionOrder.includes(s.id))]
    : allSections;
  const visible = ordered.filter(s => s.visible !== false);

  return (
    <div
      id="resume-preview-root"
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        background: '#fff',
        padding: forExport ? '36px 48px' : '32px 40px',
        minHeight: forExport ? undefined : '1056px',
        width: forExport ? '816px' : undefined,
        boxSizing: 'border-box',
        color: '#111',
      }}
    >
      {visible.map(section => {
        if (section.type === 'contact') {
          return <ContactSection key={section.id} contact={content.contact} accentColor={accentColor} />;
        }
        if (section.type === 'skills') {
          return <SkillsSection key={section.id} section={section} data={content[section.id]} />;
        }
        return (
          <ListSection
            key={section.id}
            section={section}
            entries={content[section.id] || []}
            accentColor={accentColor}
          />
        );
      })}
    </div>
  );
}