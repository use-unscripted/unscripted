import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Mail, Phone, CheckCircle, Clock, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const STATUS_OPTIONS = [
  { value: 'not_sent', label: 'Not sent', bg: '#F1F5F9', text: '#334155' },
  { value: 'sent', label: 'Sent', bg: '#FFFBEB', text: '#B45309' },
  { value: 'responded', label: 'Responded', bg: '#F0FDF4', text: '#15803D' },
  { value: 'no_response', label: 'No response', bg: '#F1F5F9', text: '#64748B' },
  { value: 'call_scheduled', label: 'Call scheduled', bg: '#F8ECEF', text: '#8B0C21' },
  { value: 'completed', label: 'Completed', bg: '#F0FDF4', text: '#15803D' },
];

function ContactModal({ contact, onClose, onSave }) {
  const [data, setData] = useState(contact || { name: '', company: '', role: '', email: '', profile_url: '', reason_for_contact: '', response_status: 'not_sent', path_being_tested: '' });
  const ch = e => setData(d => ({ ...d, [e.target.name]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="w-full max-w-lg rounded-[24px] bg-white p-6 sm:p-8">
        <div className="flex justify-between mb-6">
          <h2 className="font-heading text-xl font-bold text-[#050816]">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose}><X size={20} className="text-[#64748B]" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: 'name', label: 'Full name', placeholder: 'Jane Smith' },
            { name: 'company', label: 'Company', placeholder: 'Goldman Sachs' },
            { name: 'role', label: 'Role', placeholder: 'Analyst, Associate...' },
            { name: 'email', label: 'Email', placeholder: 'jane@company.com' },
            { name: 'profile_url', label: 'LinkedIn URL', placeholder: 'linkedin.com/in/...' },
            { name: 'path_being_tested', label: 'Path being tested', placeholder: 'Investment Banking' },
          ].map(f => (
            <label key={f.name} className="block">
              <span className="text-xs font-semibold text-[#334155] block mb-1">{f.label}</span>
              <input name={f.name} value={data[f.name] || ''} onChange={ch} placeholder={f.placeholder}
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]" />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Why are you reaching out?</span>
            <textarea rows={2} name="reason_for_contact" value={data.reason_for_contact || ''} onChange={ch}
              placeholder="What specific question can only they answer? What shared connection exists?"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Date contacted</span>
            <input type="date" name="date_contacted" value={data.date_contacted || ''} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Follow-up date</span>
            <input type="date" name="followup_date" value={data.followup_date || ''} onChange={ch}
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#334155] block mb-1">Notes</span>
            <textarea rows={2} name="notes" value={data.notes || ''} onChange={ch} placeholder="Any context or follow-up notes"
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#FAFAF9] px-3 py-2.5 text-sm outline-none focus:border-[#8B0C21]" />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-[10px] border border-[#E2E8F0] py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</button>
          <button onClick={() => onSave(data)} className="flex-1 rounded-[10px] py-3 text-sm font-semibold text-white"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function OutreachTracker() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'new' | contact object
  const [templates, setTemplates] = useState(false);

  const load = async () => {
    const data = await base44.entities.OutreachContacts.list('-created_date', 100);
    setContacts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (data) => {
    if (data.id) await base44.entities.OutreachContacts.update(data.id, data);
    else await base44.entities.OutreachContacts.create(data);
    setModal(null);
    load();
  };

  const updateStatus = async (id, response_status) => {
    await base44.entities.OutreachContacts.update(id, { response_status });
    load();
  };

  const toggleThankYou = async (c) => {
    await base44.entities.OutreachContacts.update(c.id, { thank_you_sent: !c.thank_you_sent });
    load();
  };

  const overdue = contacts.filter(c => c.followup_date && new Date(c.followup_date) < new Date() && !['completed', 'responded'].includes(c.response_status));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      {modal && <ContactModal contact={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={save} />}

      <PageHeader
        eyebrow="Outreach tracker"
        title="Networking done intentionally."
        description="Track every professional conversation. Follow up on time. Build real relationships."
        action={
          <button onClick={() => setModal('new')}
            className="flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-px"
            style={{ background: '#8B0C21', boxShadow: '0 8px 24px rgba(139,12,33,0.18)' }}>
            <Plus size={16} /> Add Contact
          </button>
        }
      />

      {overdue.length > 0 && (
        <div className="mb-6 rounded-[16px] p-4" style={{ background: '#FFFBEB', border: '1px solid rgba(180,83,9,0.25)' }}>
          <p className="text-xs font-bold uppercase tracking-wide text-[#B45309] mb-1">Follow-ups overdue</p>
          <p className="text-sm text-[#334155]">{overdue.length} contact{overdue.length > 1 ? 's' : ''} need follow-up. Reschedule or mark complete — don't let them slip.</p>
        </div>
      )}

      {/* Email Templates */}
      <div className="mb-6">
        <button onClick={() => setTemplates(!templates)} className="text-sm font-semibold transition hover:opacity-80" style={{ color: '#8B0C21' }}>
          {templates ? 'Hide' : 'View'} outreach templates →
        </button>
        {templates && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Cold email', body: 'Hi [Name],\n\nI came across your work at [Company] and was impressed by [specific detail]. I\'m a [Year] at [School] studying [Major] and exploring a career in [field].\n\nWould you be open to a 20-minute call to share your perspective on [specific question]? I have availability [times].\n\nThank you for considering it.\n\n[Your Name]' },
              { label: 'Alumni email', body: 'Hi [Name],\n\nI\'m [Your Name], a [Year] at [Shared School] studying [Major]. I found your profile through [Alumni Network/LinkedIn] and have been following your work at [Company].\n\nWould you be willing to share 20 minutes to talk about your experience in [field]? I would especially value your perspective on [specific question].\n\nThank you — and go [School Mascot]!\n\n[Your Name]' },
              { label: 'LinkedIn message', body: 'Hi [Name] — I\'m a [Year] at [School] exploring [field]. I\'d love to hear how you got into your current role at [Company]. Would you be open to a brief 20-minute call? Happy to work around your schedule.' },
              { label: 'Follow-up', body: 'Hi [Name],\n\nI wanted to follow up on my previous note. I completely understand you\'re busy, and I appreciate your time. If a 20-minute call doesn\'t work, even a brief email with one piece of advice would be incredibly helpful.\n\nThank you again.\n\n[Your Name]' },
              { label: 'Thank-you note', body: 'Hi [Name],\n\nThank you for taking the time to speak with me. Your insight about [specific thing they said] was genuinely valuable and I\'ve already begun [action taken].\n\nI\'ll keep you updated on my progress. Thank you again for your generosity.\n\n[Your Name]' },
            ].map(t => (
              <div key={t.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#8B0C21' }}>{t.label}</p>
                <pre className="text-xs text-[#334155] whitespace-pre-wrap font-body leading-5">{t.body}</pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#64748B]">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[#E2E8F0] p-16 text-center">
          <Mail size={32} className="mx-auto mb-4 text-[#CBD5E1]" />
          <h3 className="font-heading text-xl font-bold text-[#050816]">No outreach logged yet.</h3>
          <p className="mt-2 text-sm text-[#64748B]">Add your first professional contact to start tracking conversations.</p>
          <button onClick={() => setModal('new')} className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
            style={{ background: '#8B0C21' }}><Plus size={16} /> Add first contact</button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[20px] border border-[#E2E8F0] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-xs font-bold uppercase tracking-wide text-[#64748B]">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Role / Company</th>
                <th className="px-4 py-3 text-left">Path</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Follow-up</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => {
                const s = STATUS_OPTIONS.find(x => x.value === c.response_status) || STATUS_OPTIONS[0];
                const isOverdue = c.followup_date && new Date(c.followup_date) < new Date() && !['completed', 'responded'].includes(c.response_status);
                return (
                  <tr key={c.id} className="border-b border-[#E2E8F0] hover:bg-[#FAFAF9] transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#050816]">{c.name}</div>
                      {c.email && <div className="text-xs text-[#64748B]">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-[#334155]">
                      {c.role && <div>{c.role}</div>}
                      {c.company && <div className="text-xs text-[#64748B]">{c.company}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.path_being_tested && <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#F8ECEF', color: '#8B0C21' }}>{c.path_being_tested}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs outline-none"
                        style={{ background: s.bg, color: s.text }}
                        value={c.response_status}
                        onChange={e => updateStatus(c.id, e.target.value)}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {c.followup_date ? (
                        <span className={`text-xs font-semibold ${isOverdue ? 'text-[#B91C1C]' : 'text-[#64748B]'}`}>
                          {isOverdue ? '⚠ ' : ''}{new Date(c.followup_date).toLocaleDateString()}
                        </span>
                      ) : <span className="text-xs text-[#94A3B8]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleThankYou(c)} title={c.thank_you_sent ? 'Thank-you sent' : 'Mark thank-you sent'}
                          className={`p-1 rounded transition ${c.thank_you_sent ? 'text-[#15803D]' : 'text-[#CBD5E1] hover:text-[#64748B]'}`}>
                          <CheckCircle size={15} />
                        </button>
                        <button onClick={() => setModal(c)} className="p-1 rounded text-[#64748B] hover:text-[#050816] transition">
                          <Clock size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}