import Metadata from '@/components/Metadata';
import HouseSwitcher from '@/components/HouseSwitcher';
import { useActiveHouse, useHouseMembers, usePendingInvites } from '@/lib/houses';
import { useState } from 'react';

type Role = 'OWNER' | 'READ_ONLY';

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label="Role"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Role)}
      className="rounded border-2 border-secondary bg-transparent px-2 py-1 text-sm"
    >
      <option value="OWNER">Owner</option>
      <option value="READ_ONLY">Read only</option>
    </select>
  );
}

export default function HouseSettingsPage() {
  const activeHouse = useActiveHouse();
  const { data: members, mutate: mutateMembers } = useHouseMembers();
  const { data: invites, mutate: mutateInvites } = usePendingInvites();

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [newInviteRole, setNewInviteRole] = useState<Role>('READ_ONLY');
  const [generating, setGenerating] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(userId: string, role: Role) {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/houses/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        setError('Could not update that member\'s role. Please try again.');
        return;
      }
      await mutateMembers();
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function generateInvite() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/houses/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newInviteRole }),
      });
      if (!res.ok) {
        setError('Could not generate an invite. Please try again.');
        return;
      }
      const invite: { id: string; code: string } = await res.json();
      const link = `${window.location.origin}/invite/${invite.code}`;
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(invite.id);
      await mutateInvites();
    } finally {
      setGenerating(false);
    }
  }

  async function deleteInvite(inviteId: string) {
    setError(null);
    const res = await fetch(`/api/houses/invites/${inviteId}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('Could not delete that invite. Please try again.');
      return;
    }
    await mutateInvites();
  }

  if (activeHouse && activeHouse.role !== 'OWNER') {
    return (
      <>
        <Metadata title="House settings" description="Manage house members and invites" />
        <section>
          <h3 className="mb-6 text-2xl font-semibold">House settings</h3>
          <div className="mb-8">
            <HouseSwitcher />
          </div>
          <p className="text-sm opacity-70">
            Only owners of {activeHouse.name} can manage members and invites.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <Metadata title="House settings" description="Manage house members and invites" />
      <section>
        <h3 className="mb-6 text-2xl font-semibold">House settings</h3>

        <div className="mb-8">
          <HouseSwitcher />
        </div>

        {error && (
          <p role="alert" className="mb-4 text-red-600">
            {error}
          </p>
        )}

        <fieldset className="mb-8">
          <legend className="text-lg font-medium">Members</legend>
          <ul className="mt-3 flex flex-col gap-2">
            {members?.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3">
                <span>{member.email}</span>
                <RoleSelect
                  value={member.role}
                  disabled={updatingUserId === member.userId}
                  onChange={(role) => updateRole(member.userId, role)}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="mb-8">
          <legend className="text-lg font-medium">Invite someone</legend>
          <p className="mb-3 text-sm opacity-70">
            Generate a one-time invite link. The link is copied to your clipboard.
          </p>
          <div className="flex items-center gap-3">
            <RoleSelect value={newInviteRole} onChange={setNewInviteRole} disabled={generating} />
            <button type="button" className="cursor-pointer" disabled={generating} onClick={generateInvite}>
              {generating ? 'Generating…' : 'Generate invite'}
            </button>
            {copiedInviteId && <span className="text-sm text-highlight">Link copied!</span>}
          </div>
        </fieldset>

        <fieldset className="mb-8">
          <legend className="text-lg font-medium">Pending invites</legend>
          {invites && invites.length === 0 && (
            <p className="mt-3 text-sm opacity-70">No pending invites.</p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {invites?.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3">
                {/* min-w-0 lets this column shrink below its content size, which is
                    required for the code's `truncate` ellipsis to actually kick in
                    inside a flex row. */}
                <span className="min-w-0">
                  {invite.role === 'OWNER' ? 'Owner' : 'Read only'} invite, created{' '}
                  {new Date(invite.createdAt).toLocaleDateString()}
                  <br />
                  <code className="block truncate text-sm opacity-70" title={invite.code}>
                    {invite.code}
                  </code>
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer"
                  onClick={() => deleteInvite(invite.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      </section>
    </>
  );
}
