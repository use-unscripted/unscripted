import { useState } from 'react';
import { Download, FileText, File } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ResumePreview from './ResumePreview';
import { createRoot } from 'react-dom/client';

// ── PDF Export ──────────────────────────────────────────────────────────────────
async function exportPDF(resume) {
  // Use browser print dialog targeting only the preview node
  const el = document.getElementById('resume-preview-root');
  if (!el) return;

  const clone = el.cloneNode(true);
  const win = window.open('', '_blank', 'width=900,height=1100');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <title>${resume.resume_name || 'Resume'}</title>
    <style>
      @media print { @page { margin: 0; size: letter; } body { margin: 0; } }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #fff; }
    </style>
    </head><body>${el.outerHTML}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── DOCX Export ─────────────────────────────────────────────────────────────────
async function exportDOCX(resume) {
  // Build plain-text DOCX-like RTF (compatible without external lib)
  // We generate a proper HTML string and let the user save via Blob with MIME application/msword
  // which Word and Google Docs can open natively as a real document.
  const content = resume?.content || {};
  const sectionOrder = resume?.section_order || [];
  const sections = content.sections || [];
  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => sections.find(s => s.id === id)).filter(Boolean), ...sections.filter(s => !sectionOrder.includes(s.id))]
    : sections;
  const visible = ordered.filter(s => s.visible !== false);

  function fmtDate(d) {
    if (!d) return '';
    const [y, m] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m ? `${months[parseInt(m,10)-1]} ${y}` : y;
  }

  let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${resume.resume_name || 'Resume'}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; margin: 1in; color: #111; }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 2pt; }
  .contact-line { text-align: center; font-size: 9pt; color: #555; margin-bottom: 12pt; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #333; margin-top: 10pt; margin-bottom: 3pt; }
  .entry-header { display: flex; justify-content: space-between; }
  .entry-title { font-weight: bold; }
  .entry-org { }
  .entry-dates { font-style: italic; font-size: 9pt; }
  ul { margin: 2pt 0 6pt 18pt; padding: 0; }
  li { margin-bottom: 2pt; font-size: 10pt; }
  .skills-line { font-size: 10pt; }
</style></head><body>`;

  for (const section of visible) {
    if (section.type === 'contact') {
      const c = content.contact || {};
      html += `<h1>${c.name || ''}</h1>`;
      const parts = [c.email, c.phone, c.linkedin, c.github, c.portfolio, c.location].filter(Boolean);
      html += `<div class="contact-line">${parts.join(' | ')}</div>`;
    } else if (section.type === 'skills') {
      const skills = content[section.id]?.skills || [];
      if (skills.length) {
        html += `<h2>${section.label}</h2><p class="skills-line">${skills.join(' · ')}</p>`;
      }
    } else {
      const entries = (content[section.id] || []).filter(e => !e.hidden);
      if (!entries.length) continue;
      html += `<h2>${section.label}</h2>`;
      for (const e of entries) {
        const dates = [fmtDate(e.startDate), e.current ? 'Present' : fmtDate(e.endDate)].filter(Boolean).join(' – ');
        html += `<div class="entry-header"><div><span class="entry-title">${e.title || ''}</span>${e.title && e.org ? ', ' : ''}<span class="entry-org">${e.org || ''}</span></div><span class="entry-dates">${dates}</span></div>`;
        if (e.location) html += `<div style="font-size:9pt;color:#666;font-style:italic;">${e.location}</div>`;
        const bullets = (e.bullets || []).filter(b => b.trim());
        if (bullets.length) {
          html += '<ul>';
          for (const b of bullets) html += `<li>${b}</li>`;
          html += '</ul>';
        }
      }
    }
  }

  html += '</body></html>';

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${resume.resume_name || 'Resume'}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResumeExport({ resume }) {
  const [loading, setLoading] = useState('');

  const handlePDF = async () => {
    setLoading('pdf');
    await exportPDF(resume);
    setLoading('');
  };

  const handleDOCX = async () => {
    setLoading('docx');
    await exportDOCX(resume);
    setLoading('');
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button onClick={handlePDF} disabled={!!loading}
        className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50 transition">
        <FileText size={15} style={{ color: 'var(--brand-navy-900)' }} />
        {loading === 'pdf' ? 'Preparing…' : 'Download PDF'}
      </button>
      <button onClick={handleDOCX} disabled={!!loading}
        className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50 transition">
        <File size={15} style={{ color: '#1D4ED8' }} />
        {loading === 'docx' ? 'Preparing…' : 'Download Word (.doc)'}
      </button>
    </div>
  );
}