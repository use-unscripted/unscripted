import { TEMPLATES } from './resumeTemplates';

// ── Date helpers ─────────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtMonthYear(month, year) {
  if (!month && !year) return '';
  if (!month) return year;
  const m = parseInt(month, 10);
  const label = MONTHS_SHORT[m - 1] || month;
  return year ? `${label} ${year}` : label;
}

function fmtMonthInput(d) {
  // Input is YYYY-MM from <input type="month">
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  return `${MONTHS_SHORT[parseInt(m,10)-1]} ${y}`;
}

function fmtNumeric(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  return m ? `${m}/${y}` : y;
}

function DateRange({ start, end, current }) {
  if (!start && !end && !current) return null;
  const s = fmtNumeric(start);
  const e = current ? 'Present' : fmtNumeric(end);
  if (!s && !e) return null;
  return <>{s}{s && e ? ' \u2013 ' : ''}{e}</>;
}

// ════════════════════════════════════════════════════════════════════════════
// CLASSIC FINANCE PREVIEW
// ════════════════════════════════════════════════════════════════════════════

export const CF_FONTS = `@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');`;

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
        <div style={{ fontFamily: "'EB Garamond', Garamond, serif", fontSize: '11pt', color: '#000' }}>
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
  // Show only the active (non-hidden) entry
  const active = (entries || []).find(e => !e.hidden);
  if (!active) return null;

  const e = active;
  const gradDate = fmtMonthYear(e.gradMonth, e.gradYear);
  const loc = e.location || (e.city && e.state ? `${e.city}, ${e.state}` : e.city || e.state || '');

  // Build degree line: "Bachelor of Science (B.S.): Finance & Economics"
  let degreeLine = '';
  if (e.degree) {
    degreeLine = e.degree;
    if (e.degreeAbbrev) degreeLine += ` (${e.degreeAbbrev})`;
    if (e.major) {
      degreeLine += ': ' + e.major;
      if (e.secondMajor) degreeLine += ` & ${e.secondMajor}`;
    }
  } else if (e.major) {
    degreeLine = e.major;
    if (e.secondMajor) degreeLine += ` & ${e.secondMajor}`;
  }

  // Minor / concentration line
  const minorConc = [
    e.minor ? `Minor: ${e.minor}` : '',
    e.concentration ? `Concentration: ${e.concentration}` : '',
  ].filter(Boolean).join(' | ');

  return (
    <div style={{ marginBottom: '4pt' }}>
      {/* Line 1: Institution | Location    Cumulative GPA: X/Y */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8pt' }}>
        <div style={{ fontWeight: '700', fontSize: '11pt', flex: 1 }}>
          {e.institution}
          {loc && <span style={{ fontWeight: '400' }}>{'\u00A0|\u00A0'}{loc}</span>}
        </div>
        {e.gpa && e.showGpa !== false && (
          <div style={{ fontWeight: '700', whiteSpace: 'nowrap', paddingLeft: '8pt', flexShrink: 0 }}>
            Cumulative GPA: <span style={{ fontWeight: '400' }}>{e.gpa}{e.gpaScale ? `/${e.gpaScale}` : ''}</span>
          </div>
        )}
      </div>
      {/* Line 2: Degree italic    Expected Graduation: Month Year */}
      {(degreeLine || gradDate) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8pt' }}>
          <div style={{ fontStyle: 'italic', fontSize: '11pt', flex: 1 }}>
            {degreeLine}
          </div>
          {gradDate && (
            <div style={{ fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0, paddingLeft: '8pt' }}>
              Expected Graduation: {gradDate}
            </div>
          )}
        </div>
      )}
      {/* Minor / Concentration */}
      {minorConc && (
        <div style={{ fontSize: '11pt' }}>
          {minorConc.split(' | ').map((part, i) => {
            const [label, ...rest] = part.split(': ');
            return (
              <span key={i}>
                {i > 0 && <span style={{ margin: '0 4pt' }}>|</span>}
                <span style={{ fontWeight: '700' }}>{label}:</span>{' '}{rest.join(': ')}
              </span>
            );
          })}
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
    </div>
  );
}

function CFEntry({ entry, isActivity = false }) {
  const bullets = (entry.bullets || []).filter(b => b && b.trim());
  const startDate = entry.startDate ? fmtNumeric(entry.startDate) : '';
  const endDate = entry.current ? 'Present' : (entry.endDate ? fmtNumeric(entry.endDate) : '');
  const dateStr = [startDate, endDate].filter(Boolean).join(' \u2013 ');

  const locParts = [entry.location, entry.arrangement ? `(${entry.arrangement})` : ''].filter(Boolean);
  const locStr = locParts.join(' ');

  return (
    <div style={{ marginBottom: '6pt' }}>
      {/* Line 1: Org | Location (Arrangement)   Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8pt' }}>
        <div style={{ fontWeight: '700', fontSize: '11pt', flex: 1 }}>
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
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '4pt', fontSize: '11pt', lineHeight: '1.2', marginBottom: '1pt' }}>
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

function CFCertifications({ entries }) {
  const visible = (entries || []).filter(c => !c.hidden && c.name);
  if (!visible.length) return null;
  return (
    <div>
      {visible.map((c, i) => {
        const dateStr = fmtMonthYear(c.month, c.year);
        return (
          <div key={c.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11pt', marginBottom: '2pt' }}>
            <div>
              <span style={{ fontWeight: '700' }}>{c.name}</span>
              {c.issuer && <span style={{ fontWeight: '400' }}>{'\u00A0|\u00A0'}{c.issuer}</span>}
            </div>
            {dateStr && <div style={{ fontStyle: 'italic', whiteSpace: 'nowrap', paddingLeft: '8pt' }}>{dateStr}</div>}
          </div>
        );
      })}
    </div>
  );
}

function CFAwards({ entries }) {
  const visible = (entries || []).filter(a => !a.hidden && a.name);
  if (!visible.length) return null;
  return (
    <div>
      {visible.map((a, i) => {
        const dateStr = fmtMonthYear(a.month, a.year);
        return (
          <div key={a.id || i} style={{ fontSize: '11pt', marginBottom: '2pt' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontWeight: '700' }}>{a.name}</span>
                {a.issuer && <span>{'\u00A0|\u00A0'}{a.issuer}</span>}
              </div>
              {dateStr && <div style={{ fontStyle: 'italic', whiteSpace: 'nowrap', paddingLeft: '8pt' }}>{dateStr}</div>}
            </div>
            {a.description && <div style={{ fontStyle: 'italic' }}>{a.description}</div>}
          </div>
        );
      })}
    </div>
  );
}

function CFResearch({ entries }) {
  const visible = (entries || []).filter(r => !r.hidden && r.title);
  if (!visible.length) return null;
  return (
    <div>
      {visible.map((r, i) => {
        const startStr = fmtMonthYear(r.startMonth, r.startYear);
        const endStr = r.current ? 'Present' : fmtMonthYear(r.endMonth, r.endYear);
        const dateStr = [startStr, endStr].filter(Boolean).join(' \u2013 ');
        const bullets = (r.bullets || []).filter(b => b && b.trim());
        return (
          <div key={r.id || i} style={{ marginBottom: '6pt' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8pt' }}>
              <div style={{ fontWeight: '700', fontSize: '11pt', flex: 1 }}>
                {r.title}
                {r.institution && <span style={{ fontWeight: '400' }}>{'\u00A0|\u00A0'}{r.institution}</span>}
                {r.location && <span style={{ fontWeight: '400' }}>{'\u00A0|\u00A0'}{r.location}</span>}
              </div>
              {dateStr && <div style={{ fontStyle: 'italic', whiteSpace: 'nowrap', flexShrink: 0 }}>{dateStr}</div>}
            </div>
            {r.role && (
              <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
                {r.role}
                {r.advisor ? ` | Advisor: ${r.advisor}` : ''}
                {r.link ? <>{' '}<a href={r.link} style={{ color: '#000' }}>{r.link}</a></> : null}
              </div>
            )}
            {bullets.length > 0 && (
              <ul style={{ margin: '1pt 0 0 0', padding: '0', listStyle: 'none' }}>
                {bullets.map((b, bi) => (
                  <li key={bi} style={{ display: 'flex', alignItems: 'flex-start', gap: '4pt', fontSize: '11pt', lineHeight: '1.2', marginBottom: '1pt' }}>
                    <span style={{ flexShrink: 0, marginTop: '1pt' }}>&#9642;</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ClassicFinanceResume({ resume }) {
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
        if (section.type === 'cert') {
          const entries = (content[section.id] || []).filter(c => !c.hidden && c.name);
          if (!entries.length) return null;
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label || 'CERTIFICATIONS'} />
              <CFCertifications entries={entries} />
            </div>
          );
        }
        if (section.type === 'awards_cf') {
          const entries = (content[section.id] || []).filter(a => !a.hidden && a.name);
          if (!entries.length) return null;
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label || 'AWARDS'} />
              <CFAwards entries={entries} />
            </div>
          );
        }
        if (section.type === 'research') {
          const entries = (content[section.id] || []).filter(r => !r.hidden && r.title);
          if (!entries.length) return null;
          return (
            <div key={section.id}>
              <CFSectionHeading label={section.label || 'RESEARCH'} />
              <CFResearch entries={entries} />
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
// STANDARD PREVIEW (non-Classic-Finance)
// ════════════════════════════════════════════════════════════════════════════

function fmt(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  return `${MONTHS_SHORT[parseInt(m,10)-1]} ${y}`;
}

function ContactSection({ contact, accentColor }) {
  if (!contact) return null;
  const parts = [contact.email, contact.phone, contact.linkedin, contact.portfolio,
    contact.location || (contact.city && contact.state ? `${contact.city}, ${contact.state}` : contact.city || contact.state || '')]
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

function EduSection({ section, entries, accentColor }) {
  const active = (entries || []).find(e => !e.hidden);
  if (!active) return null;
  const e = active;
  const gradDate = e.gradMonth && e.gradYear ? `${MONTHS_SHORT[parseInt(e.gradMonth,10)-1]} ${e.gradYear}` : e.gradYear || '';
  const loc = e.city && e.state ? `${e.city}, ${e.state}` : e.city || e.state || '';
  let degreeLine = e.degree || '';
  if (e.degreeAbbrev) degreeLine += ` (${e.degreeAbbrev})`;
  if (e.major) { degreeLine += degreeLine ? ': ' + e.major : e.major; if (e.secondMajor) degreeLine += ` & ${e.secondMajor}`; }
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor} />
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-xs font-bold text-gray-900">{e.institution}{loc && <span className="font-normal text-gray-600"> | {loc}</span>}</span>
        {e.gpa && e.showGpa !== false && <span className="text-xs text-gray-700 whitespace-nowrap">GPA: {e.gpa}{e.gpaScale ? `/${e.gpaScale}` : ''}</span>}
      </div>
      {degreeLine && (
        <div className="flex justify-between items-baseline gap-2">
          <p className="text-xs italic text-gray-700">{degreeLine}</p>
          {gradDate && <p className="text-xs italic text-gray-600 whitespace-nowrap">Expected: {gradDate}</p>}
        </div>
      )}
      {(e.minor || e.concentration) && <p className="text-xs text-gray-700">{[e.minor && `Minor: ${e.minor}`, e.concentration && `Concentration: ${e.concentration}`].filter(Boolean).join(' | ')}</p>}
      {e.coursework && <p className="text-xs text-gray-700"><span className="font-bold">Relevant Coursework:</span> {e.coursework}</p>}
      {e.honors && <p className="text-xs text-gray-700"><span className="font-bold">Honors & Awards:</span> {e.honors}</p>}
    </div>
  );
}

function SkillsGroupedSection({ section, groups, accentColor }) {
  const visible = (groups || []).filter(g => g.items && g.items.trim());
  if (!visible.length) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor} />
      {visible.map(g => (
        <p key={g.id} className="text-xs text-gray-700 leading-relaxed"><span className="font-bold">{g.label}:</span> {g.items}</p>
      ))}
    </div>
  );
}

function CertSection({ section, entries, accentColor }) {
  const visible = (entries || []).filter(c => c.name);
  if (!visible.length) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor} />
      {visible.map((c, i) => {
        const dateStr = c.month && c.year ? `${MONTHS_SHORT[parseInt(c.month,10)-1]} ${c.year}` : c.year || '';
        return (
          <div key={i} className="flex justify-between items-baseline gap-2 text-xs mb-1">
            <span><span className="font-bold">{c.name}</span>{c.issuer && <span className="text-gray-600"> | {c.issuer}</span>}</span>
            {dateStr && <span className="text-gray-600 whitespace-nowrap italic">{dateStr}</span>}
          </div>
        );
      })}
    </div>
  );
}

function AwardsSection({ section, entries, accentColor }) {
  const visible = (entries || []).filter(a => a.name);
  if (!visible.length) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor} />
      {visible.map((a, i) => {
        const dateStr = a.month && a.year ? `${MONTHS_SHORT[parseInt(a.month,10)-1]} ${a.year}` : a.year || '';
        return (
          <div key={i} className="mb-1 text-xs">
            <div className="flex justify-between items-baseline gap-2">
              <span><span className="font-bold">{a.name}</span>{a.issuer && <span className="text-gray-600"> | {a.issuer}</span>}</span>
              {dateStr && <span className="text-gray-600 whitespace-nowrap italic">{dateStr}</span>}
            </div>
            {a.description && <p className="italic text-gray-600">{a.description}</p>}
          </div>
        );
      })}
    </div>
  );
}

function ResearchSection({ section, entries, accentColor }) {
  const visible = (entries || []).filter(r => r.title);
  if (!visible.length) return null;
  return (
    <div className="mb-4">
      <SectionHeading label={section.label} accentColor={accentColor} />
      {visible.map((r, i) => {
        const startStr = r.startMonth && r.startYear ? `${MONTHS_SHORT[parseInt(r.startMonth,10)-1]} ${r.startYear}` : r.startYear || '';
        const endStr = r.current ? 'Present' : (r.endMonth && r.endYear ? `${MONTHS_SHORT[parseInt(r.endMonth,10)-1]} ${r.endYear}` : r.endYear || '');
        const dateStr = [startStr, endStr].filter(Boolean).join(' – ');
        return (
          <div key={i} className="mb-2 text-xs">
            <div className="flex justify-between items-baseline gap-2">
              <span className="font-bold">{r.title}{r.institution && <span className="font-normal text-gray-600"> | {r.institution}</span>}</span>
              {dateStr && <span className="italic text-gray-600 whitespace-nowrap">{dateStr}</span>}
            </div>
            {r.role && <p className="italic text-gray-700">{r.role}{r.advisor ? ` | Advisor: ${r.advisor}` : ''}</p>}
            {(r.bullets || []).filter(b => b.trim()).length > 0 && (
              <ul className="mt-0.5 ml-4 list-disc space-y-0.5">
                {r.bullets.filter(b => b.trim()).map((b, bi) => <li key={bi} className="text-gray-700 leading-relaxed">{b}</li>)}
              </ul>
            )}
          </div>
        );
      })}
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
    <div id="resume-preview-root" style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff', padding: '32px 40px', minHeight: '1056px', boxSizing: 'border-box', color: '#111' }}>
      {visible.map(section => {
        if (section.type === 'contact') return <ContactSection key={section.id} contact={content.contact} accentColor={accentColor} />;
        if (section.type === 'education_cf') return <EduSection key={section.id} section={section} entries={content[section.id] || []} accentColor={accentColor} />;
        if (section.type === 'skills_grouped') return <SkillsGroupedSection key={section.id} section={section} groups={content[section.id] || []} accentColor={accentColor} />;
        if (section.type === 'cert') return <CertSection key={section.id} section={section} entries={content[section.id] || []} accentColor={accentColor} />;
        if (section.type === 'awards_cf') return <AwardsSection key={section.id} section={section} entries={content[section.id] || []} accentColor={accentColor} />;
        if (section.type === 'research') return <ResearchSection key={section.id} section={section} entries={content[section.id] || []} accentColor={accentColor} />;
        if (section.type === 'skills') return <SkillsSection key={section.id} section={section} data={content[section.id]} accentColor={accentColor} />;
        return <ListSection key={section.id} section={section} entries={content[section.id] || []} accentColor={accentColor} />;
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