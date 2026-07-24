import { TEMPLATES } from './resumeTemplates';

// ── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_NUM   = ['01','02','03','04','05','06','07','08','09','10','11','12'];

function fmtMonth(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  return `${MONTHS_SHORT[parseInt(m,10)-1]} ${y}`;
}

function fmtMonthNum(d) {
  // Returns MM/YYYY for Classic Finance style
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  return `${m}/${y}`;
}

function DateRange({ start, end, current, numeric = false }) {
  const fmt = numeric ? fmtMonthNum : fmtMonth;
  if (!start && !end && !current) return null;
  const s = fmt(start);
  const e = current ? 'Present' : fmt(end);
  if (!s && !e) return null;
  return <>{s}{s && e ? ' \u2013 ' : ''}{e}</>;
}

// ════════════════════════════════════════════════════════════════════════════
// CLASSIC FINANCE PREVIEW
// ════════════════════════════════════════════════════════════════════════════

const CF_FONTS = `@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');`;

const cfStyle = {
  fontFamily: "'EB Garamond', 'Garamond', 'Times New Roman', Georgia, serif",
  fontSize: '11pt',
  lineHeight: '1.15',
  color: '#000',
  background: '#fff',
  boxSizing: 'border-box',
};

function CFSectionHeading({ label }) {
  return (
    <div style={{ marginTop: '10pt', marginBottom: '0pt' }}>
      <div style={{
        fontFamily: "'EB Garamond', Garamond, 'Times New Roman', serif",
        fontWeight: '700',
        fontSize: '11.5pt',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: '#000',
        marginBottom: '1pt',
      }}>
        {label}
      </div>
      <div style={{ borderBottom: '0.5pt solid #000', marginBottom: '3pt' }} />
    </div>
  );
}

function CFContact({ contact }) {
  if (!contact) return null;
  const { name, email, phone, linkedin, portfolio, location, city, state } = contact;
  const loc = location || (city && state ? `${city}, ${state}` : city || state || '');
  const parts = [loc, phone, email, linkedin, portfolio].filter(Boolean);
  return (
    <div style={{ textAlign: 'center', marginBottom: '6pt' }}>
      {name && (
        <div style={{
          fontFamily: "'EB Garamond', Garamond, 'Times New Roman', serif",
          fontWeight: '700',
          fontSize: '12pt',
          color: '#000',
          marginBottom: '1pt',
        }}>
          {name}
        </div>
      )}
      {parts.length > 0 && (
        <div style={{
          fontFamily: "'EB Garamond', Garamond, serif",
          fontSize: '11.5pt',
          color: '#000',
        }}>
          {parts.map((p, i) => (
            <span key={i}>
              {p.includes('@') || p.startsWith('http') || p.includes('linkedin') || p.includes('www')
                ? <a href={p.startsWith('http') ? p : (p.includes('@') ? `mailto:${p}` : `https://${p}`)}
                    style={{ color: '#000', textDecoration: 'none' }}>{p}</a>
                : p}
              {i < parts.length - 1 && <span style={{ margin: '0 4pt' }}>|</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CFEducation({ entries }) {
  const visible = (entries || []).filter(e => !e.hidden);
  if (!visible.length) return null;
  return (
    <div style={{ marginBottom: '4pt' }}>
      {visible.map((e, idx) => {
        const gradDate = e.gradMonth && e.gradYear
          ? `${MONTHS_SHORT[parseInt(e.gradMonth,10)-1]} ${e.gradYear}`
          : e.gradYear || '';
        return (
          <div key={e.id || idx} style={{ marginBottom: idx < visible.length - 1 ? '6pt' : '0' }}>
            {/* Line 1: Institution | Date    GPA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: '700', fontSize: '11pt' }}>
                {e.institution}
                {e.location && <span style={{ fontWeight: '400' }}>{'\u00A0|\u00A0'}{e.location}</span>}
                {gradDate && <span style={{ fontWeight: '400' }}>{'\u00A0'}{gradDate}</span>}
              </div>
              {e.gpa && e.showGpa !== false && (
                <div style={{ fontWeight: '700', whiteSpace: 'nowrap', paddingLeft: '8pt' }}>
                  GPA: <span style={{ fontWeight: '400' }}>{e.gpa}{e.gpaScale ? `/${e.gpaScale}` : ''}</span>
                </div>
              )}
            </div>
            {/* Line 2: Degree italic */}
            {(e.degree || e.major) && (
              <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
                {[e.degree, e.major, e.secondMajor ? `& ${e.secondMajor}` : ''].filter(Boolean).join(' in ').replace(' in &', ' &')}
                {e.minor ? `; Minor in ${e.minor}` : ''}
              </div>
            )}
            {/* Coursework */}
            {e.coursework && (
              <div style={{ fontSize: '11pt' }}>
                <span style={{ fontWeight: '700' }}>Relevant Coursework:</span>{' '}{e.coursework}
              </div>
            )}
            {/* Honors */}
            {e.honors && (
              <div style={{ fontSize: '11pt' }}>
                <span style={{ fontWeight: '700' }}>Honors &amp; Awards:</span>{' '}{e.honors}
              </div>
            )}
            {/* Study abroad */}
            {e.studyAbroad && (
              <div style={{ fontSize: '11pt' }}>
                <span style={{ fontWeight: '700' }}>Study Abroad:</span>{' '}{e.studyAbroad}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CFEntry({ entry, isActivity = false }) {
  const bullets = (entry.bullets || []).filter(b => b && b.trim());
  const startDate = entry.startDate ? fmtMonthNum(entry.startDate) : '';
  const endDate = entry.current ? 'Present' : (entry.endDate ? fmtMonthNum(entry.endDate) : '');
  const dateStr = [startDate, endDate].filter(Boolean).join(' \u2013 ');

  // Build location/arrangement line
  const locParts = [entry.location, entry.arrangement].filter(Boolean);
  const locStr = locParts.join(' ');

  return (
    <div style={{ marginBottom: '6pt' }}>
      {/* Line 1: Org | Location   Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8pt' }}>
        <div style={{ fontWeight: '700', fontSize: '11pt', flexShrink: 0 }}>
          {entry.org || entry.title}
          {locStr && <span style={{ fontWeight: '400' }}>{'\u00A0|\u00A0'}{locStr}</span>}
        </div>
        {dateStr && (
          <div style={{ fontStyle: 'italic', whiteSpace: 'nowrap', fontSize: '11pt', flexShrink: 0 }}>
            {dateStr}
          </div>
        )}
      </div>
      {/* Line 2: Role italic */}
      {entry.title && entry.org && (
        <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
          {entry.title}
          {entry.sectorGroup ? `, ${entry.sectorGroup}` : ''}
          {entry.hoursPerWeek ? ` (${entry.hoursPerWeek} hrs/week)` : ''}
          {isActivity && entry.linkLabel && entry.linkUrl
            ? <>{' '}<span style={{ fontStyle: 'normal' }}>|</span>{' '}
              <a href={entry.linkUrl} style={{ color: '#000' }}>{entry.linkLabel}</a></>
            : null}
        </div>
      )}
      {/* Bullets */}
      {bullets.length > 0 && (
        <ul style={{ margin: '1pt 0 0 0', padding: '0', listStyle: 'none' }}>
          {bullets.map((b, i) => (
            <li key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4pt',
              fontSize: '11pt',
              lineHeight: '1.2',
              marginBottom: '1pt',
            }}>
              <span style={{ flexShrink: 0, marginTop: '1pt' }}>&#9642;</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CFSkillsGrouped({ groups }) {
  const visible = (groups || []).filter(g => !g.hidden && g.items && g.items.trim());
  if (!visible.length) return null;
  return (
    <div style={{ marginBottom: '2pt' }}>
      {visible.map((g, i) => (
        <div key={g.id || i} style={{ fontSize: '11pt', lineHeight: '1.25', marginBottom: '1pt' }}>
          <span style={{ fontWeight: '700' }}>{g.label}:</span>{' '}{g.items}
        </div>
      ))}
    </div>
  );
}

function ClassicFinanceResume({ resume }) {
  const content = resume?.content || {};
  const sectionOrder = resume?.section_order || [];
  const allSections = content.sections || [];
  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => allSections.find(s => s.id === id)).filter(Boolean),
       ...allSections.filter(s => !sectionOrder.includes(s.id))]
    : allSections;
  const visible = ordered.filter(s => s.visible !== false);

  return (
    <div style={{ ...cfStyle, padding: '36pt 36pt', minHeight: '1056px', width: '816px', boxSizing: 'border-box' }}>
      {visible.map(section => {
        if (section.type === 'contact') {
          return <CFContact key={section.id} contact={content.contact} />;
        }
        if (section.type === 'education_cf') {
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label || 'EDUCATION'} />
              <CFEducation entries={content[section.id] || []} />
            </div>
          );
        }
        if (section.type === 'skills_grouped') {
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label || 'SKILLS, TRAINING, OTHER ACTIVITIES, & INTERESTS'} />
              <CFSkillsGrouped groups={content[section.id] || []} />
            </div>
          );
        }
        if (section.type === 'list') {
          const entries = (content[section.id] || []).filter(e => !e.hidden);
          if (!entries.length) return null;
          const isActivity = section.id === 'activities' || section.label?.toLowerCase().includes('activit');
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label} />
              {entries.map((e, i) => <CFEntry key={e.id || i} entry={e} isActivity={isActivity} />)}
            </div>
          );
        }
        if (section.type === 'skills') {
          const skills = content[section.id]?.skills || [];
          if (!skills.length) return null;
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label} />
              <div style={{ fontSize: '11pt' }}>{skills.join(', ')}</div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STANDARD (non-Classic-Finance) PREVIEW  — existing behavior preserved
// ════════════════════════════════════════════════════════════════════════════

function fmt(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${y}`;
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

function SkillsSection({ section, data, accentColor }) {
  const skills = data?.skills || [];
  if (skills.length === 0) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor || '#374151'} />
      <p className="text-xs text-gray-700 leading-relaxed">{skills.join(' · ')}</p>
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
              <span className="text-xs text-gray-600 whitespace-nowrap">
                {fmt(entry.startDate)}{(entry.startDate || entry.current || entry.endDate) ? ' – ' : ''}{entry.current ? 'Present' : fmt(entry.endDate)}
              </span>
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

function StandardResume({ resume }) {
  const template = TEMPLATES.find(t => t.id === resume?.template_id) || TEMPLATES.find(t => t.id === 'general') || TEMPLATES[0];
  const accentColor = template.accentColor || '#374151';
  const content = resume?.content || {};
  const sectionOrder = resume?.section_order || [];
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
        padding: '32px 40px',
        minHeight: '1056px',
        boxSizing: 'border-box',
        color: '#111',
      }}
    >
      {visible.map(section => {
        if (section.type === 'contact') {
          return <ContactSection key={section.id} contact={content.contact} accentColor={accentColor} />;
        }
        if (section.type === 'skills') {
          return <SkillsSection key={section.id} section={section} data={content[section.id]} accentColor={accentColor} />;
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

// ════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════════════

export default function ResumePreview({ resume }) {
  const isClassicFinance = resume?.template_id === 'classic_finance';

  if (isClassicFinance) {
    return (
      <div id="resume-preview-root" style={{ background: '#fff' }}>
        <style dangerouslySetInnerHTML={{ __html: CF_FONTS }} />
        <ClassicFinanceResume resume={resume} />
      </div>
    );
  }

  return (
    <div id="resume-preview-root">
      <StandardResume resume={resume} />
    </div>
  );
}

// Named export for use in PDF generation
export { ClassicFinanceResume, CF_FONTS };