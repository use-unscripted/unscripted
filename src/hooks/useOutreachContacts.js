import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { softDeletePayload } from '@/components/SoftDeleteConfirm';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

export const contactsKey = ['OutreachContacts'];

/** Every live contact, cached so status changes and deletes can be optimistic. */
export function useOutreachContacts() {
  return useQuery({
    queryKey: contactsKey,
    queryFn: async () => {
      const rows = await base44.entities.OutreachContacts.list('-updated_date', 200);
      return (Array.isArray(rows) ? rows : []).filter(r => !r.deletion_status || r.deletion_status === 'active');
    },
  });
}

/** Any field patch on a contact: status, thank-you, notes. */
export function useUpdateContact() {
  return useOptimisticMutation({
    queryKey: contactsKey,
    mutationFn: ({ id, patch }) => base44.entities.OutreachContacts.update(id, patch),
    applyOptimistic: (rows, { id, patch }) => rows.map(c => (c.id === id ? { ...c, ...patch } : c)),
  });
}

/** Soft delete: the card leaves the list immediately. */
export function useDeleteContact() {
  return useOptimisticMutation({
    queryKey: contactsKey,
    mutationFn: async ({ id }) => {
      const user = await base44.auth.me();
      return base44.entities.OutreachContacts.update(id, softDeletePayload(user.id));
    },
    applyOptimistic: (rows, { id }) => rows.filter(c => c.id !== id),
  });
}