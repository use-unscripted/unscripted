import { X } from 'lucide-react';

/**
 * Reusable soft-delete confirmation modal.
 * Props:
 *   itemName   – displayed in the dialog
 *   onConfirm  – called when user clicks "Move to Recently Deleted"
 *   onCancel   – called when user clicks Cancel
 */
export default function SoftDeleteConfirm({ itemName, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(5,8,22,0.5)' }}>
      <div className="anim-modal w-full max-w-sm rounded-[20px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-heading text-lg font-bold text-[color:var(--surface-dark-900)]">Move to Recently Deleted?</h3>
          <button onClick={onCancel}><X size={18} className="text-[color:var(--ink-400)]" /></button>
        </div>
        {itemName && (
          <p className="text-sm font-semibold text-[color:var(--ink-700)] mb-2">"{itemName}"</p>
        )}
        <p className="text-sm text-[color:var(--ink-500)] mb-5">
          You can restore it for 30 days. After that, it will be permanently deleted.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-[10px] border border-[color:var(--ink-200)] py-2.5 text-sm font-semibold text-[color:var(--ink-700)] hover:bg-[color:var(--ink-50)] transition">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-semibold text-white transition"
            style={{ background: 'var(--brand-navy-900)' }}>
            Move to Recently Deleted
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper: build soft-delete payload
 */
export function softDeletePayload(userId) {
  const now = new Date();
  const purge = new Date(now);
  purge.setDate(purge.getDate() + 30);
  return {
    deletion_status: 'deleted',
    deleted_at: now.toISOString(),
    purge_at: purge.toISOString(),
    deleted_by_user_id: userId,
    restored_at: null,
  };
}

/**
 * Helper: build restore payload
 */
export function restorePayload() {
  return {
    deletion_status: 'active',
    purge_at: null,
    restored_at: new Date().toISOString(),
  };
}