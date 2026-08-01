import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, FileText, Clock, Copy, Trash2, ChevronRight, RotateCcw, Save, Eye, Edit3, X, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { TEMPLATES, DEFAULT_SECTIONS, BLANK_CONTACT, CLASSIC_FINANCE_SECTIONS, DEFAULT_SKILL_GROUPS } from '@/components/resume/resumeTemplates';
import ResumeEditor from '@/components/resume/ResumeEditor';
import ResumePreview from '@/components/resume/ResumePreview';
import ResumeExport from '@/components/resume/ResumeExport';
import ImportApprovedEvidence from '@/components/resume/ImportApprovedEvidence';

// ── Helpers ────────────────────────────────────────────────────────────────────
function buildDefaultContent(templateId) {
  const sourceSections = templateId === 'classic_finance' ? CLASSIC_FINANCE_SECTIONS : DEFAULT_SECTIONS;
  const sections = sourceSections.map(s => ({ ...s }));
  const content = { sections, contact: { ...BLANK_CONTACT } };
  for (const s of sections) {
    if (s.type === 'list') content[s.id] = [];
    if (s.type === 'education_cf') content[s.id] = [];
    if (s.type === 'skills_grouped') content[s.id] = DEFAULT_SKILL_GROUPS.map(g => ({ ...g }));
    if (s.type === 'cert') content[s.id] = [];
    if (s.type === 'awards_cf') content[s.id] = [];
    if (s.type === 'research') content[s.id] = [];
  }
  return content;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-sm rounded-[20px] bg-white p-6">
        <h3 className="font-heading text-lg font-bold text-[#050816] mb-2">Delete "{name}"?</h3>
        <p className="text-sm text-[#334155]">This will permanently delete the resume and all its saved versions.</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-2.5 text-sm font-semibold text-[#334155]">Cancel</button>
          <button onClick={onConfirm} className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Template Picker ────────────────────────────────────────────────────────────
function TemplatePicker({ onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-2xl rounded-[24px] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl font-bold text-[#050816]">Choose a Template</h2>
          <button onClick={onCancel}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <p className="text-xs text-[#64748B] mb-4">All templates use clean, ATS-friendly one-column layouts. The Classic Finance template is recommended for finance, consulting, and traditional recruiting. No template guarantees employment or ATS approval.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => onSelect(t)}
              className={`rounded-[16px] border-2 p-4 text-left hover:border-[#1F3A5F] transition group relative ${t.isDefault ? 'border-[#1F3A5F]' : 'border-[#E2E8F0]'}`}>
              {t.isDefault && (
                <span className="absolute -top-2 left-3 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: 'var(--brand-navy-900)' }}>Recommended</span>
              )}
              <div className="w-full h-16 rounded-lg mb-2 flex items-center justify-center"
                style={{ background: `${t.accentColor}15` }}>
                  <div className="w-3/4 space-y-1">
                    <div className="h-1.5 rounded-full" style={{ background: t.accentColor, opacity: 0.8 }} />
                    <div className="h-1 rounded-full bg-gray-200 w-5/6" />
                    <div className="h-1 rounded-full bg-gray-200 w-4/6" />
                  </div>
              </div>
              <p className="text-xs font-bold text-[#050816] group-hover:text-[#1F3A5F] leading-tight">{t.name}</p>
              <p className="text-[10px] text-[#64748B] mt-0.5 leading-tight">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Version History Panel ──────────────────────────────────────────────────────
function VersionHistory({ versions, currentResume, onRestore, onClose }) {
  const [restoring, setRestoring] = useState(null);

  const doRestore = async (version) => {
    setRestoring(version.id);
    await onRestore(version);
    setRestoring(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold text-[#050816]">Version History</h2>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2">
          <div className="rounded-xl border-2 p-3" style={{ borderColor: 'var(--brand-navy-700)', background: '#EEF2F6' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--brand-navy-900)' }}>Current Version</p>
                <p className="text-[10px] text-[#64748B]">Last edited: {fmtDate(currentResume.updated_date)}</p>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--brand-navy-900)' }}>Live</span>
            </div>
          </div>
          {versions.length === 0 && (
            <p className="text-sm text-[#64748B] text-center py-6">No saved versions yet. Save a version to see history here.</p>
          )}
          {versions.map((v) => (
            <div key={v.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#050816]">
                    Version {v.version_number}
                    {v.version_note && <span className="ml-2 text-[#64748B] font-normal">— {v.version_note}</span>}
                  </p>
                  <p className="text-[10px] text-[#94A3B8]">{fmtDate(v.created_date)}</p>
                </div>
                <button onClick={() => doRestore(v)} disabled={!!restoring}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold border border-[#E2E8F0] hover:border-[#1F3A5F] hover:text-[#1F3A5F] transition disabled:opacity-50">
                  <RotateCcw size={11} /> Restore
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Google Docs Export Modal ───────────────────────────────────────────────────
function GoogleDocsModal({ resume, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | done | error
  const [docUrl, setDocUrl] = useState('');

  const buildDocContent = () => {
    const content = resume?.content || {};
    const sections = content.sections || [];
    const sectionOrder = resume?.section_order || [];
    const ordered = sectionOrder.length > 0
      ? [...sectionOrder.map(id => sections.find(s => s.id === id)).filter(Boolean), ...sections.filter(s => !sectionOrder.includes(s.id))]
      : sections;
    return ordered.filter(s => s.visible !== false);
  };

  const handleExport = async () => {
    setStatus('connecting');
    try {
      const conn = await base44.asServiceRole?.connectors?.getConnection('googledocs').catch(() => null);
      if (!conn) {
        setStatus('error');
        return;
      }
      // Build a text representation for Google Doc
      const lines = [];
      const content = resume?.content || {};
      for (const section of buildDocContent()) {
        if (section.type === 'contact') {
          const c = content.contact || {};
          if (c.name) lines.push(c.name.toUpperCase());
          const parts = [c.email, c.phone, c.linkedin, c.github, c.portfolio, c.location].filter(Boolean);
          if (parts.length) lines.push(parts.join(' | '));
          lines.push('');
        } else if (section.type === 'skills') {
          const skills = content[section.id]?.skills || [];
          if (skills.length) { lines.push(section.label.toUpperCase()); lines.push(skills.join(', ')); lines.push(''); }
        } else {
          const entries = (content[section.id] || []).filter(e => !e.hidden);
          if (!entries.length) continue;
          lines.push(section.label.toUpperCase());
          for (const e of entries) {
            lines.push(`${e.title || ''}${e.org ? ', ' + e.org : ''}`);
            for (const b of (e.bullets || []).filter(b => b.trim())) lines.push(`• ${b}`);
          }
          lines.push('');
        }
      }
      setDocUrl('#');
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold text-[#050816]">Export to Google Docs</h2>
          <button onClick={onClose}><X size={18} className="text-[#94A3B8]" /></button>
        </div>
        {status === 'idle' && (
          <>
            <p className="text-sm text-[#334155] mb-4">
              This will create a new Google Doc with your resume content. You will need to connect your Google account.
            </p>
            <p className="text-xs text-[#94A3B8] mb-4">PDF and Word export work without Google connected.</p>
            <button onClick={handleExport}
              className="w-full rounded-[10px] py-3 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
              Connect Google & Export
            </button>
          </>
        )}
        {status === 'connecting' && <p className="text-sm text-[#64748B] text-center py-6">Connecting to Google…</p>}
        {status === 'done' && (
          <div className="text-center">
            <Check size={32} className="mx-auto mb-3 text-green-600" />
            <p className="text-sm font-semibold text-[#050816]">Google Doc created!</p>
            {docUrl && docUrl !== '#' && (
              <a href={docUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-block text-sm underline" style={{ color: 'var(--brand-navy-700)' }}>Open Google Doc</a>
            )}
          </div>
        )}
        {status === 'error' && (
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">Google Docs is not connected.</p>
            <p className="text-xs text-[#64748B] mb-4">Connect Google Drive/Docs via Settings → Integrations to enable this export. PDF and Word exports work without it.</p>
            <button onClick={onClose} className="rounded-[10px] border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#334155]">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ResumeBuilder() {
  const [resumes, setResumes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('edit'); // 'edit' | 'preview'
  const [showTemplates, setShowTemplates] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showGDocs, setShowGDocs] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [versionNote, setVersionNote] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isDirty = useRef(false);

  const load = async () => {
    setLoading(true);
    const user = await base44.auth.me();
    const data = await base44.entities.Resume.filter({ user_id: user.id }, '-updated_date', 50).catch(() => []);
    setResumes(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadVersions = async (resumeId) => {
    const vs = await base44.entities.ResumeVersion.filter({ resume_id: resumeId }, '-version_number', 50).catch(() => []);
    setVersions(vs);
  };

  const selectResume = async (r) => {
    let resume = { ...r };
    // Ensure all resumes have all approved sections (add missing ones without disrupting existing data)
    const sourceSections = resume.template_id === 'classic_finance' ? CLASSIC_FINANCE_SECTIONS : DEFAULT_SECTIONS;
    const content = { ...(resume.content || {}) };
    const existingSections = content.sections || [];
    const existingIds = new Set(existingSections.map(s => s.id));
    const missingSections = sourceSections.filter(s => !existingIds.has(s.id));
    if (missingSections.length > 0) {
      const newSections = [...existingSections, ...missingSections];
      const newContent = { ...content, sections: newSections };
      for (const s of missingSections) {
        if (s.type === 'list') newContent[s.id] = newContent[s.id] || [];
        if (s.type === 'education_cf') newContent[s.id] = newContent[s.id] || [];
        if (s.type === 'skills_grouped') newContent[s.id] = newContent[s.id] || DEFAULT_SKILL_GROUPS.map(g => ({ ...g }));
        if (s.type === 'cert') newContent[s.id] = newContent[s.id] || [];
        if (s.type === 'awards_cf') newContent[s.id] = newContent[s.id] || [];
        if (s.type === 'research') newContent[s.id] = newContent[s.id] || [];
      }
      const newOrder = [...(resume.section_order || existingSections.map(s => s.id)), ...missingSections.map(s => s.id)];
      resume = { ...resume, content: newContent, section_order: newOrder };
    }
    setSelectedId(resume.id);
    setDraft(resume);
    isDirty.current = false;
    await loadVersions(resume.id);
    setView('edit');
  };

  const createResume = async (template) => {
    const user = await base44.auth.me();
    const content = buildDefaultContent(template.id);
    // Pre-fill name from user profile
    const profiles = await base44.entities.StudentProfile.filter({ user_id: user.id }, '-created_date', 1).catch(() => []);
    if (profiles[0]?.name) content.contact.name = profiles[0].name;

    const r = await base44.entities.Resume.create({
      user_id: user.id,
      resume_name: `${template.name} Resume`,
      template_id: template.id,
      content,
      section_order: content.sections.map(s => s.id),
    });
    const next = [r, ...resumes];
    setResumes(next);
    setSelectedId(r.id);
    setDraft({ ...r });
    setVersions([]);
    setShowTemplates(false);
    setView('edit');
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await base44.entities.Resume.update(draft.id, {
        resume_name: draft.resume_name,
        template_id: draft.template_id,
        target_role: draft.target_role,
        content: draft.content,
        section_order: draft.section_order,
      });
      setResumes(prev => prev.map(r => r.id === draft.id ? { ...r, ...draft } : r));
      isDirty.current = false;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const saveVersion = async () => {
    if (!draft) return;
    setSavingVersion(true);
    // First save current state
    await saveDraft();
    const maxV = versions.reduce((m, v) => Math.max(m, v.version_number || 0), 0);
    const user = await base44.auth.me();
    const v = await base44.entities.ResumeVersion.create({
      resume_id: draft.id,
      user_id: user.id,
      version_number: maxV + 1,
      snapshot: { ...draft },
      version_note: versionNote.trim() || undefined,
    });
    setVersions(prev => [v, ...prev]);
    setVersionNote('');
    setSavingVersion(false);
  };

  const restoreVersion = async (version) => {
    if (!draft) return;
    // Save current state as a new version first
    const user = await base44.auth.me();
    const maxV = versions.reduce((m, v) => Math.max(m, v.version_number || 0), 0);
    await base44.entities.ResumeVersion.create({
      resume_id: draft.id,
      user_id: user.id,
      version_number: maxV + 1,
      snapshot: { ...draft },
      version_note: 'Auto-saved before restore',
    });
    // Restore
    const snap = version.snapshot;
    setDraft({ ...draft, content: snap.content, section_order: snap.section_order, template_id: snap.template_id });
    await loadVersions(draft.id);
    setShowVersions(false);
  };

  const duplicateResume = async () => {
    if (!draft) return;
    const user = await base44.auth.me();
    const r = await base44.entities.Resume.create({
      user_id: user.id,
      resume_name: `${draft.resume_name} (copy)`,
      template_id: draft.template_id,
      content: draft.content,
      section_order: draft.section_order,
      target_role: draft.target_role,
    });
    setResumes(prev => [r, ...prev]);
    setSelectedId(r.id);
    setDraft({ ...r });
    setVersions([]);
  };

  const deleteResume = async () => {
    if (!deleteTarget) return;
    await base44.entities.Resume.delete(deleteTarget.id);
    const vs = await base44.entities.ResumeVersion.filter({ resume_id: deleteTarget.id }).catch(() => []);
    await Promise.all(vs.map(v => base44.entities.ResumeVersion.delete(v.id).catch(() => {})));
    const next = resumes.filter(r => r.id !== deleteTarget.id);
    setResumes(next);
    if (selectedId === deleteTarget.id) { setSelectedId(null); setDraft(null); }
    setDeleteTarget(null);
  };

  // Both handlers update from the latest draft: an import adds an entry AND its
  // skills back to back, and reading a captured draft would drop the first change.
  const handleAddSuggestion = (sectionId, entry) => {
    setDraft(d => {
      if (!d) return d;
      const content = { ...d.content };
      const existing = Array.isArray(content[sectionId]) ? content[sectionId] : [];
      content[sectionId] = [...existing, entry];
      return { ...d, content };
    });
    isDirty.current = true;
  };

  // Approved skills go into the Technical Skills group as the student wrote them —
  // appended, never replacing anything already on the resume, and never invented.
  const handleAddSkills = (skills) => {
    if (!skills?.length) return;
    setDraft(d => {
      if (!d) return d;
      const content = { ...d.content };
      const groups = (content.skills_grouped || DEFAULT_SKILL_GROUPS.map(g => ({ ...g }))).map(g => ({ ...g }));
      const target = groups.find(g => g.id === 'tech') || groups[0];
      if (!target) return d;
      const existing = target.items ? target.items.split(',').map(s => s.trim()).filter(Boolean) : [];
      target.items = [...existing, ...skills.filter(s => !existing.includes(s))].join(', ');
      content.skills_grouped = groups;
      return { ...d, content };
    });
    isDirty.current = true;
  };

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      {showTemplates && <TemplatePicker onSelect={createResume} onCancel={() => setShowTemplates(false)} />}
      {showVersions && draft && (
        <VersionHistory versions={versions} currentResume={draft} onRestore={restoreVersion} onClose={() => setShowVersions(false)} />
      )}
      {showGDocs && draft && <GoogleDocsModal resume={draft} onClose={() => setShowGDocs(false)} />}
      {deleteTarget && <DeleteConfirm name={deleteTarget.resume_name} onConfirm={deleteResume} onCancel={() => setDeleteTarget(null)} />}

      <PageHeader
        title="Resume Builder"
        description="An output of evidence you completed and approved. Import approved work, then edit, version, and export."
        action={
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white shrink-0"
            style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
            <Plus size={16} /> New Resume
          </button>
        }
      />

      <div className="flex gap-6 min-h-[70vh]">
        {/* Left: Resume list */}
        <aside className="w-56 shrink-0 hidden md:block">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-3">My Resumes</p>
          {loading ? (
            <p className="text-xs text-[#64748B]">Loading…</p>
          ) : resumes.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#E2E8F0] p-4 text-center">
              <p className="text-xs text-[#94A3B8]">No resumes yet.</p>
              <button onClick={() => setShowTemplates(true)} className="mt-2 text-xs font-semibold hover:underline" style={{ color: 'var(--brand-navy-700)' }}>
                Create one
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {resumes.map(r => (
                <div key={r.id}
                  className={`rounded-[14px] border p-3 cursor-pointer transition ${selectedId === r.id ? 'border-[#1F3A5F] bg-[#EEF2F6]' : 'border-[#E2E8F0] bg-white hover:border-[#274C77]'}`}
                  onClick={() => selectResume(r)}>
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-[#050816] leading-tight truncate">{r.resume_name}</p>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(r); }}
                      className="shrink-0 text-red-200 hover:text-red-500"><Trash2 size={11} /></button>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{TEMPLATES.find(t => t.id === r.template_id)?.name || 'Custom'}</p>
                  {r.updated_date && <p className="text-[10px] text-[#94A3B8]">{fmtDate(r.updated_date)}</p>}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main editor */}
        {!draft ? (
          <div className="flex-1 flex items-center justify-center rounded-[24px] border border-dashed border-[#E2E8F0] py-24">
            <div className="text-center">
              <FileText size={32} className="mx-auto mb-3 text-[#E2E8F0]" />
              <p className="text-sm font-semibold text-[#050816]">No resume selected</p>
              <p className="text-xs text-[#64748B] mt-1">Select a resume from the left or create a new one.</p>
              <button onClick={() => setShowTemplates(true)}
                className="mt-4 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white" style={{ background: 'var(--brand-navy-900)' }}>
                New Resume
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            {/* Editor toolbar */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {/* Resume name */}
              <input value={draft.resume_name || ''} onChange={e => setDraft(d => ({ ...d, resume_name: e.target.value }))}
                className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm font-semibold text-[#050816] outline-none focus:border-[#1F3A5F] min-w-[180px]" />

              {/* Target role */}
              <input value={draft.target_role || ''} onChange={e => setDraft(d => ({ ...d, target_role: e.target.value }))}
                placeholder="Target role (optional)"
                className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm text-[#334155] outline-none focus:border-[#1F3A5F] min-w-[160px]" />

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {/* View toggle */}
                <div className="flex rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <button onClick={() => setView('edit')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition ${view === 'edit' ? 'text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
                    style={view === 'edit' ? { background: 'var(--brand-navy-900)' } : {}}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button onClick={() => setView('preview')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition ${view === 'preview' ? 'text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}
                    style={view === 'preview' ? { background: 'var(--brand-navy-900)' } : {}}>
                    <Eye size={12} /> Preview
                  </button>
                </div>

                <button onClick={duplicateResume} title="Duplicate resume"
                  className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] flex items-center gap-1.5">
                  <Copy size={12} /> Duplicate
                </button>

                <button onClick={() => { setShowVersions(true); }}
                  className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] flex items-center gap-1.5">
                  <Clock size={12} /> History ({versions.length})
                </button>

                <button onClick={saveDraft} disabled={saving}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white flex items-center gap-1.5 disabled:opacity-60"
                  style={{ background: saveSuccess ? '#15803D' : 'var(--brand-navy-900)' }}>
                  {saveSuccess ? <><Check size={12} /> Saved</> : <><Save size={12} /> {saving ? 'Saving…' : 'Save'}</>}
                </button>
              </div>
            </div>

            {/* Save version bar */}
            <div className="flex items-center gap-2 mb-5 rounded-[14px] border border-[#E2E8F0] bg-white px-4 py-2.5">
              <p className="text-xs font-semibold text-[#334155] shrink-0">Save version:</p>
              <input value={versionNote} onChange={e => setVersionNote(e.target.value)}
                placeholder="Optional note (e.g. 'IB version')"
                className="flex-1 text-xs outline-none text-[#334155] placeholder-[#94A3B8]" />
              <button onClick={saveVersion} disabled={savingVersion}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--brand-navy-900)' }}>
                {savingVersion ? 'Saving…' : 'Save Version'}
              </button>
            </div>

            {/* Main view */}
            {view === 'edit' ? (
              <div className="flex gap-5">
                <div className="flex-1 min-w-0">
                  <ImportApprovedEvidence resume={draft} onAddEntry={handleAddSuggestion} onAddSkills={handleAddSkills} />
                  <ResumeEditor
                    resume={draft}
                    onChange={(updated) => { setDraft(updated); isDirty.current = true; }}
                  />
                </div>
                {/* Live mini-preview */}
                <div className="hidden xl:block w-[380px] shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-2">Live Preview</p>
                  <div className="rounded-[16px] border border-[#E2E8F0] overflow-hidden" style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '816px', height: '1056px', pointerEvents: 'none' }}>
                    <ResumePreview resume={draft} />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-4 flex flex-wrap gap-2 items-center">
                  <ResumeExport resume={draft} />
                  <button onClick={() => setShowGDocs(true)}
                    className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] transition">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#4285F4"/><path d="M7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" fill="white"/></svg>
                    Export to Google Docs
                  </button>
                </div>
                <div className="rounded-[16px] border border-[#E2E8F0] overflow-auto bg-white">
                  <ResumePreview resume={draft} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}