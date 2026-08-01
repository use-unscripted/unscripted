import { useState } from 'react';
import { Download, FileText, File } from 'lucide-react';
import { safeExternalUrl } from '@/lib/safe-url';

// One escaper for both exports. Quotes matter as much as angle brackets here:
// these strings are concatenated into attributes as well as text, so a value
// containing a double quote could otherwise close the attribute and add its own.
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtM(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y;
  return `${MONTHS_SHORT[parseInt(m,10)-1]} ${y}`;
}
function fmtNum(d) {
  if (!d) return '';
  const [y, m] = d.split('-');
  return m ? `${m}/${y}` : y;
}

// ── Classic Finance PDF ─────────────────────────────────────────────────────
function buildCFHtml(resume) {
  const content = resume?.content || {};
  const sectionOrder = resume?.section_order || [];
  const allSections = content.sections || [];
  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => allSections.find(s => s.id === id)).filter(Boolean),
       ...allSections.filter(s => !sectionOrder.includes(s.id))]
    : allSections;
  const visible = ordered.filter(s => s.visible !== false);

  let body = '';

  for (const section of visible) {
    if (section.type === 'contact') {
      const c = content.contact || {};
      const loc = c.location || (c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || '');
      const parts = [loc, c.phone, c.email, c.linkedin, c.portfolio].filter(Boolean);
      body += `<div class="cf-header">`;
      if (c.name) body += `<div class="cf-name">${esc(c.name)}</div>`;
      if (parts.length) {
        const line = parts.map((p, i) => {
          const sep = i < parts.length - 1 ? '<span class="sep">|</span>' : '';
          if (p.includes('@')) return `<a href="mailto:${esc(p)}">${esc(p)}</a>${sep}`;
          if (p.startsWith('http') || p.includes('linkedin') || p.includes('www')) {
            // Only an http(s) URL becomes a link; anything else prints as text.
            const href = safeExternalUrl(p) || safeExternalUrl(`https://${p}`);
            if (href) return `<a href="${esc(href)}">${esc(p)}</a>${sep}`;
            return `${esc(p)}${sep}`;
          }
          return `${esc(p)}${sep}`;
        }).join('');
        body += `<div class="cf-contact-line">${line}</div>`;
      }
      body += `</div>`;
      continue;
    }

    if (section.type === 'education_cf') {
      body += `<div class="cf-section-heading">${esc(section.label || 'EDUCATION')}</div><hr class="cf-rule">`;
      // Only the active (non-hidden) entry
      const active = (content[section.id] || []).find(e => !e.hidden);
      if (!active) continue;
      const e = active;
      const gradDate = e.gradMonth && e.gradYear
        ? `${MONTHS_SHORT[parseInt(e.gradMonth,10)-1]} ${e.gradYear}`
        : e.gradYear || '';
      const loc = e.location || (e.city && e.state ? `${e.city}, ${e.state}` : e.city || e.state || '');
      // Degree line
      let degLine = '';
      if (e.degree) {
        degLine = e.degree;
        if (e.degreeAbbrev) degLine += ` (${e.degreeAbbrev})`;
        if (e.major) {
          degLine += ': ' + e.major;
          if (e.secondMajor) degLine += ` &amp; ${e.secondMajor}`;
        }
      } else if (e.major) {
        degLine = e.major;
        if (e.secondMajor) degLine += ` &amp; ${e.secondMajor}`;
      }
      const minorConc = [
        e.minor ? `Minor: ${e.minor}` : '',
        e.concentration ? `Concentration: ${e.concentration}` : '',
      ].filter(Boolean).join(' | ');

      body += `<div class="cf-edu-block">`;
      // Line 1: Institution | Location    Cumulative GPA
      body += `<div class="cf-row">`;
      body += `<div class="cf-left"><b>${esc(e.institution)}</b>`;
      if (loc) body += `&nbsp;|&nbsp;${esc(loc)}`;
      body += `</div>`;
      if (e.gpa && e.showGpa !== false) {
        body += `<div class="cf-right"><b>Cumulative GPA:</b>&nbsp;${esc(e.gpa)}${e.gpaScale ? '/' + esc(e.gpaScale) : ''}</div>`;
      }
      body += `</div>`;
      // Line 2: Degree italic    Expected Graduation
      if (degLine || gradDate) {
        body += `<div class="cf-row">`;
        body += `<div class="cf-left cf-italic">${esc(degLine)}</div>`;
        if (gradDate) body += `<div class="cf-right cf-italic">Expected Graduation: ${esc(gradDate)}</div>`;
        body += `</div>`;
      }
      // Minor / concentration
      if (minorConc) body += `<div>${minorConc.split(' | ').map(p => { const [lbl, ...rest] = p.split(': '); return `<b>${esc(lbl)}:</b>&nbsp;${esc(rest.join(': '))}`; }).join('&nbsp;|&nbsp;')}</div>`;
      if (e.coursework) body += `<div><b>Relevant Coursework:</b>&nbsp;${esc(e.coursework)}</div>`;
      if (e.honors) body += `<div><b>Honors &amp; Awards:</b>&nbsp;${esc(e.honors)}</div>`;
      body += `</div>`;
      continue;
    }

    if (section.type === 'skills_grouped') {
      body += `<div class="cf-section-heading">${esc(section.label || 'SKILLS')}</div><hr class="cf-rule">`;
      const groups = (content[section.id] || []).filter(g => !g.hidden && g.items && g.items.trim());
      for (const g of groups) {
        body += `<div><b>${esc(g.label)}:</b>&nbsp;${esc(g.items)}</div>`;
      }
      continue;
    }

    if (section.type === 'list') {
      const entries = (content[section.id] || []).filter(e => !e.hidden);
      if (!entries.length) continue;
      const isActivity = section.id === 'activities' || (section.label || '').toLowerCase().includes('activit');
      body += `<div class="cf-section-heading">${esc(section.label)}</div><hr class="cf-rule">`;
      for (const e of entries) {
        const startD = e.startDate ? fmtNum(e.startDate) : '';
        const endD = e.current ? 'Present' : (e.endDate ? fmtNum(e.endDate) : '');
        const dateStr = [startD, endD].filter(Boolean).join(' \u2013 ');
        const loc = [e.location, e.arrangement].filter(Boolean).join(' ');
        body += `<div class="cf-entry-block">`;
        body += `<div class="cf-row">`;
        body += `<div class="cf-left"><b>${esc(e.org || e.title)}</b>`;
        if (loc) body += `&nbsp;|&nbsp;${esc(loc)}`;
        body += `</div>`;
        if (dateStr) body += `<div class="cf-right cf-italic">${esc(dateStr)}</div>`;
        body += `</div>`;
        if (e.title && e.org) {
          let roleLine = esc(e.title);
          if (e.sectorGroup) roleLine += `, ${esc(e.sectorGroup)}`;
          if (e.hoursPerWeek) roleLine += ` (${esc(e.hoursPerWeek)} hrs/week)`;
          body += `<div class="cf-italic">${roleLine}</div>`;
        }
        const bullets = (e.bullets || []).filter(b => b && b.trim());
        if (bullets.length) {
          body += `<ul class="cf-bullets">`;
          for (const b of bullets) body += `<li>${esc(b)}</li>`;
          body += `</ul>`;
        }
        body += `</div>`;
      }
      continue;
    }

    if (section.type === 'cert') {
      const entries = (content[section.id] || []).filter(c => !c.hidden && c.name);
      if (!entries.length) continue;
      body += `<div class="cf-section-heading">${esc(section.label || 'CERTIFICATIONS')}</div><hr class="cf-rule">`;
      for (const c of entries) {
        const dateStr = c.month && c.year
          ? `${MONTHS_SHORT[parseInt(c.month,10)-1]} ${c.year}`
          : (c.year || '');
        body += `<div class="cf-row"><div><b>${esc(c.name)}</b>`;
        if (c.issuer) body += `&nbsp;|&nbsp;${esc(c.issuer)}`;
        body += `</div>`;
        if (dateStr) body += `<div class="cf-right cf-italic">${esc(dateStr)}</div>`;
        body += `</div>`;
      }
      continue;
    }

    if (section.type === 'awards_cf') {
      const entries = (content[section.id] || []).filter(a => !a.hidden && a.name);
      if (!entries.length) continue;
      body += `<div class="cf-section-heading">${esc(section.label || 'AWARDS')}</div><hr class="cf-rule">`;
      for (const a of entries) {
        const dateStr = a.month && a.year
          ? `${MONTHS_SHORT[parseInt(a.month,10)-1]} ${a.year}`
          : (a.year || '');
        body += `<div class="cf-row"><div><b>${esc(a.name)}</b>`;
        if (a.issuer) body += `&nbsp;|&nbsp;${esc(a.issuer)}`;
        body += `</div>`;
        if (dateStr) body += `<div class="cf-right cf-italic">${esc(dateStr)}</div>`;
        body += `</div>`;
        if (a.description) body += `<div class="cf-italic">${esc(a.description)}</div>`;
      }
      continue;
    }

    if (section.type === 'research') {
      const entries = (content[section.id] || []).filter(r => !r.hidden && r.title);
      if (!entries.length) continue;
      body += `<div class="cf-section-heading">${esc(section.label || 'RESEARCH')}</div><hr class="cf-rule">`;
      for (const r of entries) {
        const startStr = r.startMonth && r.startYear ? `${MONTHS_SHORT[parseInt(r.startMonth,10)-1]} ${r.startYear}` : (r.startYear || '');
        const endStr = r.current ? 'Present' : (r.endMonth && r.endYear ? `${MONTHS_SHORT[parseInt(r.endMonth,10)-1]} ${r.endYear}` : (r.endYear || ''));
        const dateStr = [startStr, endStr].filter(Boolean).join(' \u2013 ');
        body += `<div class="cf-entry-block">`;
        body += `<div class="cf-row"><div class="cf-left"><b>${esc(r.title)}</b>`;
        if (r.institution) body += `&nbsp;|&nbsp;${esc(r.institution)}`;
        if (r.location) body += `&nbsp;|&nbsp;${esc(r.location)}`;
        body += `</div>`;
        if (dateStr) body += `<div class="cf-right cf-italic">${esc(dateStr)}</div>`;
        body += `</div>`;
        if (r.role) {
          body += `<div class="cf-italic">${esc(r.role)}`;
          if (r.advisor) body += ` | Advisor: ${esc(r.advisor)}`;
          body += `</div>`;
        }
        const bullets = (r.bullets || []).filter(b => b && b.trim());
        if (bullets.length) {
          body += `<ul class="cf-bullets">`;
          for (const b of bullets) body += `<li>${esc(b)}</li>`;
          body += `</ul>`;
        }
        body += `</div>`;
      }
      continue;
    }

    if (section.type === 'skills') {
      const skills = content[section.id]?.skills || [];
      if (!skills.length) continue;
      body += `<div class="cf-section-heading">${esc(section.label)}</div><hr class="cf-rule">`;
      body += `<div>${esc(skills.join(', '))}</div>`;
    }
  }

  const contactData = content.contact || {};
  const safeName = (contactData.name || 'Resume').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');

  return { html: body, safeName };
}

async function exportCFPdf(resume) {
  const { html, safeName } = buildCFHtml(resume);

  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) return;

  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${safeName}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<style>
  @page { size: letter portrait; margin: 0.5in; }
  * { box-sizing: border-box; }
  body {
    font-family: 'EB Garamond', Garamond, 'Times New Roman', Georgia, serif;
    font-size: 11pt;
    line-height: 1.15;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  @media screen {
    body { padding: 0.5in; max-width: 8.5in; }
  }
  .cf-header { text-align: center; margin-bottom: 6pt; }
  .cf-name { font-weight: 700; font-size: 12pt; }
  .cf-contact-line { font-size: 11.5pt; }
  .cf-contact-line a { color: #000; text-decoration: none; }
  .sep { margin: 0 4pt; }
  .cf-section-heading {
    font-weight: 700;
    font-size: 11.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 10pt;
    margin-bottom: 1pt;
  }
  hr.cf-rule {
    border: none;
    border-top: 0.5pt solid #000;
    margin: 0 0 3pt 0;
  }
  .cf-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8pt;
  }
  .cf-left { flex: 1; }
  .cf-right { flex-shrink: 0; white-space: nowrap; }
  .cf-bold { font-weight: 700; }
  .cf-italic { font-style: italic; }
  .cf-edu-block { margin-bottom: 6pt; }
  .cf-entry-block { margin-bottom: 6pt; }
  .cf-bullets {
    margin: 1pt 0 0 0;
    padding: 0;
    list-style: none;
  }
  .cf-bullets li {
    display: flex;
    align-items: flex-start;
    gap: 4pt;
    font-size: 11pt;
    line-height: 1.2;
    margin-bottom: 1pt;
  }
  .cf-bullets li::before {
    content: "\\25AA";
    flex-shrink: 0;
    margin-top: 1pt;
  }
  b { font-weight: 700; }
  a { color: #000; }
  @media print {
    body { padding: 0; }
    .cf-section-heading { page-break-after: avoid; }
    .cf-edu-block, .cf-entry-block { page-break-inside: avoid; }
  }
</style>
</head><body>${html}</body></html>`);

  win.document.close();
  // Wait for fonts to load before printing
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
    }, 800);
  };
  // Fallback in case onload already fired
  setTimeout(() => {
    try { win.focus(); win.print(); } catch(_) {}
  }, 1500);
}

// ── Standard PDF Export ──────────────────────────────────────────────────────
async function exportStandardPdf(resume) {
  const el = document.getElementById('resume-preview-root');
  if (!el) return;

  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return;

  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${esc(resume.resume_name || 'Resume')}</title>
<style>
  @media print { @page { margin: 0; size: letter; } body { margin: 0; } }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #fff; }
</style>
</head><body>${el.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── DOCX Export (HTML-based .doc) ─────────────────────────────────────────────
// Note: This produces a .doc file (HTML with Word namespace) not a true .docx.
// It opens and is editable in Microsoft Word and Google Docs.
async function exportDOCX(resume) {
  const isClassicFinance = resume?.template_id === 'classic_finance';
  const content = resume?.content || {};
  const sectionOrder = resume?.section_order || [];
  const sections = content.sections || [];
  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => sections.find(s => s.id === id)).filter(Boolean), ...sections.filter(s => !sectionOrder.includes(s.id))]
    : sections;
  const visible = ordered.filter(s => s.visible !== false);

  const fontFamily = isClassicFinance
    ? "'EB Garamond', Garamond, 'Times New Roman', Georgia, serif"
    : "Arial, Helvetica, sans-serif";

  let body = '';

  for (const section of visible) {
    if (section.type === 'contact') {
      const c = content.contact || {};
      const loc = c.location || (c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || '');
      const parts = [loc, c.phone, c.email, c.linkedin, c.portfolio].filter(Boolean);
      body += `<h1>${esc(c.name || '')}</h1>`;
      body += `<div class="contact-line">${parts.map(p => esc(p)).join(' | ')}</div>`;
    } else if (section.type === 'education_cf') {
      body += `<h2>${esc(section.label || 'EDUCATION')}</h2>`;
      const active = (content[section.id] || []).find(e => !e.hidden);
      if (active) {
        const e = active;
        const gradDate = e.gradMonth && e.gradYear
          ? `${MONTHS_SHORT[parseInt(e.gradMonth,10)-1]} ${e.gradYear}` : e.gradYear || '';
        const loc = e.location || (e.city && e.state ? `${e.city}, ${e.state}` : e.city || e.state || '');
        let degLine = '';
        if (e.degree) {
          degLine = e.degree;
          if (e.degreeAbbrev) degLine += ` (${e.degreeAbbrev})`;
          if (e.major) { degLine += ': ' + e.major; if (e.secondMajor) degLine += ` & ${e.secondMajor}`; }
        } else if (e.major) { degLine = e.major; if (e.secondMajor) degLine += ` & ${e.secondMajor}`; }
        body += `<div class="entry-header"><div><b>${esc(e.institution)}</b>${loc ? ` | ${esc(loc)}` : ''}</div>`;
        if (e.gpa && e.showGpa !== false) body += `<div><b>Cumulative GPA:</b> ${esc(e.gpa)}${e.gpaScale ? '/' + esc(e.gpaScale) : ''}</div>`;
        body += `</div>`;
        if (degLine) body += `<div class="entry-italic">${esc(degLine)}${gradDate ? ` &mdash; Expected Graduation: ${esc(gradDate)}` : ''}</div>`;
        if (e.minor || e.concentration) {
          const mc = [e.minor ? `Minor: ${e.minor}` : '', e.concentration ? `Concentration: ${e.concentration}` : ''].filter(Boolean).join(' | ');
          body += `<div>${esc(mc)}</div>`;
        }
        if (e.coursework) body += `<div><b>Relevant Coursework:</b> ${esc(e.coursework)}</div>`;
        if (e.honors) body += `<div><b>Honors &amp; Awards:</b> ${esc(e.honors)}</div>`;
      }
    } else if (section.type === 'cert') {
      const entries = (content[section.id] || []).filter(c => !c.hidden && c.name);
      if (entries.length) {
        body += `<h2>${esc(section.label || 'CERTIFICATIONS')}</h2>`;
        for (const c of entries) {
          const dateStr = c.month && c.year ? `${MONTHS_SHORT[parseInt(c.month,10)-1]} ${c.year}` : (c.year || '');
          body += `<div class="entry-header"><div><b>${esc(c.name)}</b>${c.issuer ? ` | ${esc(c.issuer)}` : ''}</div><span class="entry-dates">${esc(dateStr)}</span></div>`;
        }
      }
    } else if (section.type === 'awards_cf') {
      const entries = (content[section.id] || []).filter(a => !a.hidden && a.name);
      if (entries.length) {
        body += `<h2>${esc(section.label || 'AWARDS')}</h2>`;
        for (const a of entries) {
          const dateStr = a.month && a.year ? `${MONTHS_SHORT[parseInt(a.month,10)-1]} ${a.year}` : (a.year || '');
          body += `<div class="entry-header"><div><b>${esc(a.name)}</b>${a.issuer ? ` | ${esc(a.issuer)}` : ''}</div><span class="entry-dates">${esc(dateStr)}</span></div>`;
          if (a.description) body += `<div class="entry-italic">${esc(a.description)}</div>`;
        }
      }
    } else if (section.type === 'research') {
      const entries = (content[section.id] || []).filter(r => !r.hidden && r.title);
      if (entries.length) {
        body += `<h2>${esc(section.label || 'RESEARCH')}</h2>`;
        for (const r of entries) {
          const startStr = r.startMonth && r.startYear ? `${MONTHS_SHORT[parseInt(r.startMonth,10)-1]} ${r.startYear}` : (r.startYear || '');
          const endStr = r.current ? 'Present' : (r.endMonth && r.endYear ? `${MONTHS_SHORT[parseInt(r.endMonth,10)-1]} ${r.endYear}` : (r.endYear || ''));
          const dateStr = [startStr, endStr].filter(Boolean).join(' – ');
          body += `<div class="entry-header"><div><b>${esc(r.title)}</b>${r.institution ? ` | ${esc(r.institution)}` : ''}${r.location ? ` | ${esc(r.location)}` : ''}</div><span class="entry-dates">${esc(dateStr)}</span></div>`;
          if (r.role) body += `<div class="entry-italic">${esc(r.role)}${r.advisor ? ` | Advisor: ${esc(r.advisor)}` : ''}</div>`;
          const bullets = (r.bullets || []).filter(b => b && b.trim());
          if (bullets.length) { body += '<ul>'; for (const b of bullets) body += `<li>${esc(b)}</li>`; body += '</ul>'; }
        }
      }
    } else if (section.type === 'skills_grouped') {
      body += `<h2>${esc(section.label || 'SKILLS')}</h2>`;
      const groups = (content[section.id] || []).filter(g => !g.hidden && g.items && g.items.trim());
      for (const g of groups) body += `<div><b>${esc(g.label)}:</b> ${esc(g.items)}</div>`;
    } else if (section.type === 'list') {
      const entries = (content[section.id] || []).filter(e => !e.hidden);
      if (!entries.length) continue;
      body += `<h2>${esc(section.label)}</h2>`;
      for (const e of entries) {
        const startD = e.startDate ? fmtM(e.startDate) : '';
        const endD = e.current ? 'Present' : fmtM(e.endDate);
        const dates = [startD, endD].filter(Boolean).join(' – ');
        body += `<div class="entry-header"><div><b>${esc(e.org || e.title)}</b>${e.location ? ` | ${esc(e.location)}` : ''}</div><span class="entry-dates">${esc(dates)}</span></div>`;
        if (e.title && e.org) body += `<div class="entry-italic">${esc(e.title)}${e.sectorGroup ? `, ${esc(e.sectorGroup)}` : ''}</div>`;
        const bullets = (e.bullets || []).filter(b => b && b.trim());
        if (bullets.length) {
          body += '<ul>';
          for (const b of bullets) body += `<li>${esc(b)}</li>`;
          body += '</ul>';
        }
      }
    } else if (section.type === 'skills') {
      const skills = content[section.id]?.skills || [];
      if (skills.length) {
        body += `<h2>${esc(section.label)}</h2><div>${esc(skills.join(', '))}</div>`;
      }
    }
  }

  const contactName = (content.contact?.name || 'Resume').replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, '_');

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${esc(resume.resume_name || 'Resume')}</title>
<style>
  body { font-family: ${fontFamily}; font-size: 11pt; margin: 1in; color: #000; }
  h1 { font-size: 12pt; text-align: center; margin-bottom: 2pt; font-weight: bold; }
  .contact-line { text-align: center; font-size: 11pt; margin-bottom: 10pt; }
  h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 0.5pt solid #000; margin-top: 10pt; margin-bottom: 3pt; font-weight: bold; }
  .entry-header { display: flex; justify-content: space-between; font-size: 11pt; }
  .entry-italic { font-style: italic; font-size: 11pt; }
  .entry-dates { font-style: italic; font-size: 11pt; white-space: nowrap; }
  ul { margin: 2pt 0 4pt 12pt; padding: 0; }
  li { margin-bottom: 1pt; font-size: 11pt; }
</style></head><body>${body}</body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${contactName}_Resume.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ResumeExport({ resume }) {
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const isClassicFinance = resume?.template_id === 'classic_finance';

  const handlePDF = async () => {
    if (loading) return;
    setError('');
    setLoading('pdf');
    try {
      if (isClassicFinance) {
        await exportCFPdf(resume);
      } else {
        await exportStandardPdf(resume);
      }
    } catch (e) {
      setError('PDF export failed. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const handleDOCX = async () => {
    if (loading) return;
    setError('');
    setLoading('docx');
    try {
      await exportDOCX(resume);
    } catch (e) {
      setError('Word export failed. Please try again.');
    } finally {
      setLoading('');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button onClick={handlePDF} disabled={!!loading}
          className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50 transition">
          <FileText size={15} style={{ color: 'var(--brand-navy-900)' }} />
          {loading === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button onClick={handleDOCX} disabled={!!loading}
          className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50 transition">
          <File size={15} style={{ color: '#1D4ED8' }} />
          {loading === 'docx' ? 'Preparing…' : 'Download Word (.doc)'}
        </button>
      </div>
      {isClassicFinance && (
        <p className="mt-1.5 text-[10px] text-[#94A3B8]">
          Word export produces a .doc file (HTML format) editable in Microsoft Word and Google Docs. True .docx requires an additional integration.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}