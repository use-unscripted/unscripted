import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Plus, GripVertical, Sparkles, X, Undo2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { newEntry } from './resumeTemplates';

// ── AI Bullet Helper ────────────────────────────────────────────────────────────
function BulletAIPopover({ bullet, onApply, onClose }) {
  const [result, setResult] = useState('');
  const [original] = useState(bullet);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('');

  const actions = [
    { id: 'improve', label: 'Improve this bullet' },
    { id: 'concise', label: 'Make more concise' },
    { id: 'action', label: 'Add action-oriented language' },
    { id: 'claims', label: 'Check for unsupported claims' },
  ];

  const run = async (actionId) => {
    setMode(actionId);
    setLoading(true);
    const prompts = {
      improve: `Improve this resume bullet to be stronger and more impact-focused. Return ONLY the improved bullet text, nothing else. Original: "${bullet}"`,
      concise: `Make this resume bullet more concise while keeping all key information. Return ONLY the revised bullet. Original: "${bullet}"`,
      action: `Rewrite this resume bullet starting with a strong action verb. Return ONLY the revised bullet. Original: "${bullet}"`,
      claims: `Review this resume bullet for unsupported or vague claims. List any claims that lack specifics, then suggest how to strengthen them. Original: "${bullet}"`,
    };
    try {
      const res = await base44.integrations.Core.InvokeLLM({ prompt: prompts[actionId] });
      setResult(typeof res === 'string' ? res.trim() : JSON.stringify(res));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-80 rounded-xl border border-[#E2E8F0] bg-white shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-[#050816] flex items-center gap-1.5"><Sparkles size={12} style={{ color: '#8B0C21' }} /> AI Bullet Help</p>
        <button onClick={onClose}><X size={14} className="text-[#94A3B8]" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {actions.map(a => (
          <button key={a.id} onClick={() => run(a.id)} disabled={loading}
            className="rounded-full border border-[#E2E8F0] px-2.5 py-1 text-[10px] font-semibold text-[#334155] hover:border-[#8B0C21] hover:text-[#8B0C21] transition disabled:opacity-50">
            {a.label}
          </button>
        ))}
      </div>
      {loading && <p className="text-xs text-[#64748B]">Generating…</p>}
      {result && (
        <div className="rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-3 mb-3">
          <p className="text-xs text-[#050816] leading-relaxed">{result}</p>
        </div>
      )}
      {result && mode !== 'claims' && (
        <div className="flex gap-2">
          <button onClick={() => onApply(result)}
            className="flex-1 rounded-lg py-2 text-xs font-semibold text-white" style={{ background: '#8B0C21' }}>
            Apply
          </button>
          <button onClick={() => onApply(original)}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-xs font-semibold text-[#334155] flex items-center justify-center gap-1">
            <Undo2 size={11} /> Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ── Entry Editor ────────────────────────────────────────────────────────────────
function EntryEditor({ entry, onChange, onRemove, onDuplicate }) {
  const [expanded, setExpanded] = useState(true);
  const [aiTarget, setAiTarget] = useState(null); // bullet index

  const set = (k, v) => onChange({ ...entry, [k]: v });
  const setBullet = (i, v) => {
    const bullets = [...entry.bullets];
    bullets[i] = v;
    set('bullets', bullets);
  };
  const addBullet = () => set('bullets', [...entry.bullets, '']);
  const removeBullet = (i) => set('bullets', entry.bullets.filter((_, idx) => idx !== i));
  const moveBullet = (i, dir) => {
    const b = [...entry.bullets];
    const ni = i + dir;
    if (ni < 0 || ni >= b.length) return;
    [b[i], b[ni]] = [b[ni], b[i]];
    set('bullets', b);
  };

  return (
    <div className={`rounded-xl border ${entry.hidden ? 'border-dashed border-[#E2E8F0] opacity-60' : 'border-[#E2E8F0]'} bg-white mb-3`}>
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <GripVertical size={14} className="text-[#94A3B8] shrink-0" />
        <p className="flex-1 text-sm font-semibold text-[#050816] truncate">{entry.title || entry.org || 'New entry'}</p>
        <button type="button" onClick={e => { e.stopPropagation(); onChange({ ...entry, hidden: !entry.hidden }); }}
          title={entry.hidden ? 'Show' : 'Hide'} className="text-[#94A3B8] hover:text-[#334155]">
          {entry.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button type="button" onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Duplicate"
          className="text-[#94A3B8] hover:text-[#334155] text-[10px] font-semibold px-1">⊕</button>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
        {expanded ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">Title / Role</label>
              <input value={entry.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Analyst Intern"
                className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none focus:border-[#8B0C21]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">Organization</label>
              <input value={entry.org} onChange={e => set('org', e.target.value)} placeholder="e.g. Goldman Sachs"
                className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none focus:border-[#8B0C21]" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">Location</label>
              <input value={entry.location} onChange={e => set('location', e.target.value)} placeholder="City, State"
                className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none focus:border-[#8B0C21]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">Start</label>
              <input type="month" value={entry.startDate} onChange={e => set('startDate', e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none focus:border-[#8B0C21]" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] mb-1">
                End {entry.current ? '(current)' : ''}
              </label>
              <div className="flex gap-1 items-center">
                <input type="month" value={entry.current ? '' : entry.endDate} onChange={e => set('endDate', e.target.value)} disabled={entry.current}
                  className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none focus:border-[#8B0C21] disabled:opacity-40" />
                <label className="flex items-center gap-1 text-[10px] text-[#64748B] cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={!!entry.current} onChange={e => set('current', e.target.checked)} className="accent-[#8B0C21]" />
                  Now
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#64748B] mb-1">Bullet Points</label>
            {entry.bullets.map((b, i) => (
              <div key={i} className="relative flex items-start gap-1 mb-1">
                <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
                  <button type="button" onClick={() => moveBullet(i, -1)} disabled={i === 0}
                    className="text-[#94A3B8] hover:text-[#334155] disabled:opacity-20"><ChevronUp size={11} /></button>
                  <button type="button" onClick={() => moveBullet(i, 1)} disabled={i === entry.bullets.length - 1}
                    className="text-[#94A3B8] hover:text-[#334155] disabled:opacity-20"><ChevronDown size={11} /></button>
                </div>
                <textarea value={b} onChange={e => setBullet(i, e.target.value)} rows={2}
                  placeholder="Start with an action verb…"
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs resize-none outline-none focus:border-[#8B0C21]" />
                <div className="flex flex-col gap-0.5 pt-1 shrink-0">
                  <button type="button" title="AI Help" onClick={() => setAiTarget(aiTarget === i ? null : i)}
                    className="text-[#94A3B8] hover:text-[#8B0C21]"><Sparkles size={11} /></button>
                  <button type="button" onClick={() => removeBullet(i)} disabled={entry.bullets.length === 1}
                    className="text-red-300 hover:text-red-500 disabled:opacity-20"><X size={11} /></button>
                </div>
                {aiTarget === i && (
                  <BulletAIPopover
                    bullet={b}
                    onApply={val => { setBullet(i, val); setAiTarget(null); }}
                    onClose={() => setAiTarget(null)}
                  />
                )}
              </div>
            ))}
            <button type="button" onClick={addBullet}
              className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[#64748B] hover:text-[#8B0C21]">
              <Plus size={11} /> Add bullet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skills Editor ────────────────────────────────────────────────────────────────
function SkillsEditor({ data, onChange }) {
  const skills = data?.skills || [];
  const raw = skills.join(', ');
  return (
    <div className="p-3">
      <label className="block text-[10px] font-semibold text-[#64748B] mb-1">Skills (comma-separated)</label>
      <textarea rows={3} value={raw}
        onChange={e => onChange({ ...data, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="Python, Excel, Financial Modeling, Communication…"
        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs resize-none outline-none focus:border-[#8B0C21]" />
    </div>
  );
}

// ── Contact Editor ───────────────────────────────────────────────────────────────
function ContactEditor({ contact, onChange }) {
  const set = (k, v) => onChange({ ...contact, [k]: v });
  const fields = [
    { k: 'name', label: 'Full Name', placeholder: 'Your Name' },
    { k: 'email', label: 'Email', placeholder: 'you@school.edu' },
    { k: 'phone', label: 'Phone', placeholder: '555-123-4567' },
    { k: 'linkedin', label: 'LinkedIn URL', placeholder: 'linkedin.com/in/...' },
    { k: 'github', label: 'GitHub', placeholder: 'github.com/...' },
    { k: 'portfolio', label: 'Portfolio / Website', placeholder: 'yoursite.com' },
    { k: 'location', label: 'City, State (optional)', placeholder: 'New York, NY' },
  ];
  return (
    <div className="p-3 grid grid-cols-2 gap-2">
      {fields.map(f => (
        <div key={f.k} className={f.k === 'name' ? 'col-span-2' : ''}>
          <label className="block text-[10px] font-semibold text-[#64748B] mb-1">{f.label}</label>
          <input value={contact?.[f.k] || ''} onChange={e => set(f.k, e.target.value)} placeholder={f.placeholder}
            className="w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs outline-none focus:border-[#8B0C21]" />
        </div>
      ))}
      <p className="col-span-2 text-[10px] text-[#94A3B8]">Home address is not required and not collected.</p>
    </div>
  );
}

// ── Section Panel ────────────────────────────────────────────────────────────────
function SectionPanel({ section, data, onChange, onMoveUp, onMoveDown, onToggleVisible, onRename, onRemove, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(section.label);

  const addEntry = () => {
    const entries = Array.isArray(data) ? data : [];
    onChange([...entries, newEntry()]);
  };

  return (
    <div className={`rounded-[16px] border mb-3 ${section.visible === false ? 'border-dashed border-[#E2E8F0] opacity-60' : 'border-[#E2E8F0]'} bg-[#FAFAF9]`}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="text-[#94A3B8] hover:text-[#334155] disabled:opacity-20"><ChevronUp size={13} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="text-[#94A3B8] hover:text-[#334155] disabled:opacity-20"><ChevronDown size={13} /></button>
        </div>
        {renaming ? (
          <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
            onBlur={() => { onRename(nameInput); setRenaming(false); }}
            onKeyDown={e => e.key === 'Enter' && (onRename(nameInput), setRenaming(false))}
            className="flex-1 rounded-lg border border-[#8B0C21] px-2 py-1 text-xs font-bold outline-none" />
        ) : (
          <button onClick={() => setExpanded(e => !e)} className="flex-1 text-left text-sm font-bold text-[#050816]">
            {section.label}
          </button>
        )}
        <button onClick={() => setRenaming(r => !r)} title="Rename"
          className="text-[10px] text-[#94A3B8] hover:text-[#334155] font-semibold px-1">✎</button>
        <button onClick={onToggleVisible} title={section.visible === false ? 'Show' : 'Hide'}
          className="text-[#94A3B8] hover:text-[#334155]">
          {section.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        {section.custom && (
          <button onClick={onRemove} className="text-red-300 hover:text-red-500"><Trash2 size={13} /></button>
        )}
        <button onClick={() => setExpanded(e => !e)} className="text-[#94A3B8]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2">
          {section.type === 'contact' && (
            <ContactEditor contact={data} onChange={onChange} />
          )}
          {section.type === 'skills' && (
            <SkillsEditor data={data} onChange={onChange} />
          )}
          {section.type === 'list' && (
            <>
              {(Array.isArray(data) ? data : []).map((entry, i, arr) => (
                <EntryEditor
                  key={entry.id}
                  entry={entry}
                  onChange={updated => {
                    const next = [...arr];
                    next[i] = updated;
                    onChange(next);
                  }}
                  onRemove={() => onChange(arr.filter((_, idx) => idx !== i))}
                  onDuplicate={() => {
                    const dup = { ...entry, id: Math.random().toString(36).slice(2) };
                    const next = [...arr];
                    next.splice(i + 1, 0, dup);
                    onChange(next);
                  }}
                />
              ))}
              <button onClick={addEntry}
                className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] hover:border-[#8B0C21] hover:text-[#8B0C21] w-full justify-center transition">
                <Plus size={13} /> Add entry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResumeEditor({ resume, onChange }) {
  const content = resume?.content || {};
  const sections = content.sections || [];
  const sectionOrder = resume?.section_order || sections.map(s => s.id);

  const ordered = sectionOrder.length > 0
    ? [...sectionOrder.map(id => sections.find(s => s.id === id)).filter(Boolean),
       ...sections.filter(s => !sectionOrder.includes(s.id))]
    : sections;

  const updateSection = (idx, section, data) => {
    const nextSections = ordered.map((s, i) => i === idx ? section : s);
    const nextContent = { ...content, sections: nextSections, [section.id]: data };
    onChange({ ...resume, content: nextContent, section_order: nextSections.map(s => s.id) });
  };

  const moveSection = (idx, dir) => {
    const arr = [...ordered];
    const ni = idx + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    onChange({ ...resume, content: { ...content, sections: arr }, section_order: arr.map(s => s.id) });
  };

  const addCustomSection = () => {
    const label = 'Custom Section';
    const id = Math.random().toString(36).slice(2);
    const section = { id, label, type: 'list', visible: true, custom: true };
    const nextSections = [...ordered, section];
    onChange({ ...resume, content: { ...content, sections: nextSections, [id]: [] }, section_order: nextSections.map(s => s.id) });
  };

  const renameSection = (idx, label) => {
    const nextSections = ordered.map((s, i) => i === idx ? { ...s, label } : s);
    onChange({ ...resume, content: { ...content, sections: nextSections }, section_order: nextSections.map(s => s.id) });
  };

  const removeSection = (idx) => {
    const removed = ordered[idx];
    const nextSections = ordered.filter((_, i) => i !== idx);
    const nextContent = { ...content, sections: nextSections };
    delete nextContent[removed.id];
    onChange({ ...resume, content: nextContent, section_order: nextSections.map(s => s.id) });
  };

  const toggleVisible = (idx) => {
    const s = ordered[idx];
    const nextSections = ordered.map((sec, i) => i === idx ? { ...sec, visible: sec.visible === false ? true : false } : sec);
    onChange({ ...resume, content: { ...content, sections: nextSections }, section_order: nextSections.map(s => s.id) });
  };

  return (
    <div>
      {ordered.map((section, idx) => (
        <SectionPanel
          key={section.id}
          section={section}
          data={content[section.id]}
          onChange={(data) => updateSection(idx, section, data)}
          onMoveUp={() => moveSection(idx, -1)}
          onMoveDown={() => moveSection(idx, 1)}
          onToggleVisible={() => toggleVisible(idx)}
          onRename={(label) => renameSection(idx, label)}
          onRemove={() => removeSection(idx)}
          isFirst={idx === 0}
          isLast={idx === ordered.length - 1}
        />
      ))}
      <button onClick={addCustomSection}
        className="w-full flex items-center justify-center gap-2 rounded-[16px] border border-dashed border-[#E2E8F0] py-3 text-sm font-semibold text-[#64748B] hover:border-[#8B0C21] hover:text-[#8B0C21] transition mt-2">
        <Plus size={14} /> Add custom section
      </button>
    </div>
  );
}