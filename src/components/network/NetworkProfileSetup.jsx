import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { makeSlug } from '@/lib/network-utils';
import { Upload, CheckCircle } from 'lucide-react';

const inputCls = 'mt-1 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#050816] placeholder-[#94A3B8] outline-none focus:border-[#274C77]';

/**
 * Profile setup / edit form for the current user's network profile.
 * Creates or updates NetworkProfile. Never touches auth User entity fields other than display_name.
 */
export default function NetworkProfileSetup({ currentUser, profile, onSaved }) {
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    university_name: '',
    major: '',
    academic_year: '',
    show_major: false,
    show_academic_year: false,
    show_path_categories: false,
    public_path_categories: [],
    profile_visibility: 'private',
    discoverable: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        university_name: profile.university_name || '',
        major: profile.major || '',
        academic_year: profile.academic_year || '',
        show_major: !!profile.show_major,
        show_academic_year: !!profile.show_academic_year,
        show_path_categories: !!profile.show_path_categories,
        public_path_categories: profile.public_path_categories || [],
        profile_visibility: profile.profile_visibility || 'private',
        discoverable: !!profile.discoverable,
        profile_image_url: profile.profile_image_url || '',
      });
    } else if (currentUser) {
      setForm(f => ({
        ...f,
        display_name: currentUser.full_name || '',
        university_name: currentUser.college || '',
        major: currentUser.major || '',
        academic_year: currentUser.school_year || '',
      }));
    }
  }, [profile, currentUser]);

  const change = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      change('profile_image_url', file_url);
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setImageUploading(false);
    }
  };

  const addCategory = () => {
    const cat = newCat.trim();
    if (!cat || form.public_path_categories.includes(cat)) { setNewCat(''); return; }
    change('public_path_categories', [...form.public_path_categories, cat]);
    setNewCat('');
  };

  const removeCategory = (cat) => {
    change('public_path_categories', form.public_path_categories.filter(c => c !== cat));
  };

  const save = async () => {
    if (!form.display_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        user_id: currentUser.id,
        display_name: form.display_name.trim(),
        bio: form.bio.trim(),
        university_name: form.university_name.trim(),
        major: form.major.trim(),
        academic_year: form.academic_year.trim(),
        show_major: form.show_major,
        show_academic_year: form.show_academic_year,
        show_path_categories: form.show_path_categories,
        public_path_categories: form.public_path_categories,
        profile_visibility: form.profile_visibility,
        discoverable: form.discoverable,
        active: true,
        ...(form.profile_image_url ? { profile_image_url: form.profile_image_url } : {}),
      };
      if (profile?.id) {
        await base44.entities.NetworkProfile.update(profile.id, payload);
      } else {
        payload.profile_slug = makeSlug(form.display_name);
        payload.verification_status = 'unverified';
        await base44.entities.NetworkProfile.create(payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setSaving(false);
    }
  };

  const visibilityOpts = [
    { value: 'private', label: 'Private — only you' },
    { value: 'my_university', label: 'My University' },
    { value: 'all_unscripted', label: 'All Unscripted users' },
  ];

  return (
    <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-7 space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: 'var(--background-tertiary)' }}>
          {form.profile_image_url
            ? <img src={form.profile_image_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold" style={{ color: 'var(--text-muted)' }}>{(form.display_name || '?')[0]?.toUpperCase()}</span>
          }
        </div>
        <div>
          <label className="cursor-pointer flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-semibold transition hover:opacity-80"
            style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
            <Upload size={12} /> {imageUploading ? 'Uploading…' : 'Upload photo'}
            <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={imageUploading} />
          </label>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>JPG, PNG. Shown on your campus profile.</p>
        </div>
      </div>

      <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Display name <span className="text-red-500">*</span>
        <input type="text" value={form.display_name} onChange={e => change('display_name', e.target.value)}
          className={inputCls} placeholder="Your public name" maxLength={60} />
      </label>

      <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        Short bio <span className="font-normal" style={{ color: 'var(--text-muted)' }}>Optional</span>
        <textarea rows={2} value={form.bio} onChange={e => change('bio', e.target.value)}
          className={`${inputCls} resize-none`} placeholder="What you're exploring and building…" maxLength={200} />
      </label>

      <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
        University
        <input type="text" value={form.university_name} onChange={e => change('university_name', e.target.value)}
          className={inputCls} placeholder="e.g. Virginia Tech" maxLength={100} />
      </label>

      {/* Toggles for what to show publicly */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: 'var(--text-muted)' }}>What to show publicly</p>
        {[
          { key: 'show_major', label: 'Show my major', sub: form.major },
          { key: 'show_academic_year', label: 'Show my academic year', sub: form.academic_year },
          { key: 'show_path_categories', label: 'Show public path interests', sub: '' },
        ].map(({ key, label, sub }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {label} {sub && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({sub})</span>}
            </span>
            <button type="button" onClick={() => change(key, !form[key])}
              className="rounded-full w-9 h-5 transition-colors relative"
              style={{ background: form[key] ? 'var(--brand-navy-900)' : 'var(--border-light)' }}
              role="switch" aria-checked={form[key]}>
              <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                style={{ left: form[key] ? '17px' : '2px' }} />
            </button>
          </label>
        ))}
      </div>

      {/* Path categories */}
      {form.show_path_categories && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Public path interests</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {form.public_path_categories.map(cat => (
              <span key={cat} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                style={{ background: 'var(--background-tertiary)', color: 'var(--brand-navy-700)' }}>
                {cat}
                <button onClick={() => removeCategory(cat)} className="ml-0.5 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
              className={`${inputCls} mt-0 flex-1`} placeholder="e.g. Healthcare, Consulting" maxLength={40} />
            <button type="button" onClick={addCategory}
              className="rounded-[10px] px-3 py-2 text-xs font-semibold"
              style={{ background: 'var(--brand-navy-900)', color: 'white' }}>Add</button>
          </div>
        </div>
      )}

      {/* Profile visibility */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Profile visibility</p>
        <div className="space-y-2">
          {visibilityOpts.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="profile_visibility" value={opt.value}
                checked={form.profile_visibility === opt.value}
                onChange={() => change('profile_visibility', opt.value)}
                className="accent-[#1F3A5F]" />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Discoverability */}
      <label className="flex items-center justify-between cursor-pointer">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Campus discovery</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Let verified students at your university find you in Discover</p>
        </div>
        <button type="button" onClick={() => change('discoverable', !form.discoverable)}
          className="rounded-full w-9 h-5 transition-colors relative ml-4"
          style={{ background: form.discoverable ? 'var(--brand-navy-900)' : 'var(--border-light)' }}
          role="switch" aria-checked={form.discoverable}>
          <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
            style={{ left: form.discoverable ? '17px' : '2px' }} />
        </button>
      </label>

      <button onClick={save} disabled={saving || !form.display_name.trim()}
        className="w-full rounded-[10px] px-5 py-3 font-semibold text-white transition disabled:opacity-60"
        style={{ background: 'var(--brand-navy-900)', boxShadow: '0 8px 24px rgba(31,58,95,0.25)' }}>
        {saved ? <span className="flex items-center justify-center gap-2"><CheckCircle size={15} /> Saved</span> : saving ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  );
}