import Metadata from '@/components/Metadata';
import HouseSwitcher from '@/components/HouseSwitcher';
import {
  useActiveHouse,
  useHouseMembers,
  usePendingInvites,
  useApiKeys,
  type PendingInvite,
  type CreatedApiKey,
} from '@/lib/houses';
import { useState } from 'react';
import {
  useFindMe,
  updateHouseMemberRole,
  removeHouseMember,
  createInvite,
  deleteHouseInvite,
  createApiKey as createApiKeyMutation,
  revokeApiKey as revokeApiKeyMutation,
} from '@/types/generated/client';
import { isSuccessResponse } from '@/lib/apiClientMutator';
import type { components } from '@/types/generated/api';

type Role = components['schemas']['HouseMember']['role'];

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
    // p-2 matches the 0.5rem padding buttons get for free from the global
    // `button` base style (main.css), so this lines up with the buttons next
    // to it without either needing its own height override.
    <select
      aria-label="Role"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Role)}
      className="rounded border-2 border-secondary bg-black p-2 text-sm text-white"
    >
      {/* See HouseSwitcher for why each <option> needs its own dark colours. */}
      <option value="OWNER" className="bg-black text-white">Owner</option>
      <option value="READ_ONLY" className="bg-black text-white">Read only</option>
    </select>
  );
}

export default function HouseSettingsPage() {
  const activeHouse = useActiveHouse();
  const { data: members, mutate: mutateMembers } = useHouseMembers();
  const { data: invites, mutate: mutateInvites } = usePendingInvites();
  const { data: apiKeys, mutate: mutateApiKeys } = useApiKeys();
  // Current user's id, so we don't offer to remove yourself (cached by AccessGate).
  const { data: meResponse } = useFindMe();
  const me = meResponse && isSuccessResponse(meResponse) ? meResponse.data : undefined;

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [newInviteRole, setNewInviteRole] = useState<Role>('READ_ONLY');
  const [generating, setGenerating] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRole, setNewKeyRole] = useState<Role>('READ_ONLY');
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateRole(userId: string, role: Role) {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const result = await updateHouseMemberRole(userId, { role });
      if (!isSuccessResponse(result)) {
        setError('Could not update that member\'s role. Please try again.');
        return;
      }
      await mutateMembers();
    } catch {
      setError('Could not update that member\'s role. Please try again.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function removeMember(userId: string, handle: string | null | undefined) {
    if (!window.confirm(`Remove ${handle ?? 'this member'} from ${activeHouse?.name}?`)) return;
    setUpdatingUserId(userId);
    setError(null);
    try {
      const result = await removeHouseMember(userId);
      if (!isSuccessResponse(result)) {
        setError('Could not remove that member. Please try again.');
        return;
      }
      await mutateMembers();
    } catch {
      setError('Could not remove that member. Please try again.');
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function generateInvite() {
    setGenerating(true);
    setError(null);
    try {
      const result = await createInvite({ role: newInviteRole });
      if (!isSuccessResponse(result)) {
        setError('Could not generate an invite. Please try again.');
        return;
      }
      const invite: PendingInvite = result.data;
      const link = `${window.location.origin}/invite/${invite.code}`;
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(invite.id);
      await mutateInvites();
    } catch {
      setError('Could not generate an invite. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function deleteInvite(inviteId: string) {
    setError(null);
    try {
      const result = await deleteHouseInvite(inviteId);
      if (!isSuccessResponse(result)) {
        setError('Could not delete that invite. Please try again.');
        return;
      }
      await mutateInvites();
    } catch {
      setError('Could not delete that invite. Please try again.');
    }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setError(null);
    try {
      const result = await createApiKeyMutation({
        name: newKeyName.trim(),
        role: newKeyRole,
      });
      if (!isSuccessResponse(result)) {
        setError('Could not create that API key. Please try again.');
        return;
      }
      const created: CreatedApiKey = result.data;
      setRevealedKey(created);
      setNewKeyName('');
      await mutateApiKeys();
    } catch {
      setError('Could not create that API key. Please try again.');
    } finally {
      setCreatingKey(false);
    }
  }

  async function revokeApiKey(keyId: string) {
    if (!window.confirm('Revoke this API key? Anything using it will stop working immediately.')) return;
    setError(null);
    try {
      const result = await revokeApiKeyMutation(keyId);
      if (!isSuccessResponse(result)) {
        setError('Could not revoke that key. Please try again.');
        return;
      }
      await mutateApiKeys();
    } catch {
      setError('Could not revoke that key. Please try again.');
    }
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
                <span>{member.handle ?? '(no handle set)'}</span>
                <div className="flex items-center gap-2">
                  <RoleSelect
                    value={member.role}
                    disabled={updatingUserId === member.userId}
                    onChange={(role) => updateRole(member.userId, role)}
                  />
                  {me && member.userId !== me.id && (
                    <button
                      type="button"
                      aria-label={`Remove ${member.handle ?? 'member'}`}
                      title="Remove member"
                      disabled={updatingUserId === member.userId}
                      onClick={() => removeMember(member.userId, member.handle)}
                      className="shrink-0 cursor-pointer rounded border-2 border-red-600 px-2 text-sm text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="mb-8">
          <legend className="text-lg font-medium">Invite someone</legend>
          <p className="mb-3 text-sm opacity-70">
            Generate a one-time invite link. The link will be copied to your clipboard.
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

        <fieldset className="mb-8">
          <legend className="text-lg font-medium">API keys</legend>
          <p className="mb-3 text-sm opacity-70">
            Create a service-account key for a third-party app (e.g. Home Assistant) that can&apos;t sign in interactively.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              aria-label="Key name"
              placeholder="e.g. Home Assistant"
              value={newKeyName}
              disabled={creatingKey}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="min-w-0 flex-1 rounded border-2 border-secondary bg-black p-2 text-sm text-white sm:flex-none"
            />
            <RoleSelect value={newKeyRole} onChange={setNewKeyRole} disabled={creatingKey} />
            <button type="button" className="cursor-pointer" disabled={creatingKey || !newKeyName.trim()} onClick={createApiKey}>
              {creatingKey ? 'Creating…' : 'Create key'}
            </button>
          </div>

          {revealedKey && (
            <div className="mt-4 rounded border-2 border-highlight p-3">
              <p className="mb-2 text-sm">
                Copy this key now — you won&apos;t be able to see it again.
              </p>
              {/* break-all (not truncate) so the whole secret stays visible and wraps
                  within the column, rather than truncating it or overflowing on narrow
                  viewports — the point of this box is to let it actually be read. */}
              <code className="mb-3 block break-all text-sm">{revealedKey.rawKey}</code>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => navigator.clipboard.writeText(revealedKey.rawKey)}
                >
                  Copy
                </button>
                <button type="button" className="cursor-pointer" onClick={() => setRevealedKey(null)}>
                  Done
                </button>
              </div>
            </div>
          )}

          {apiKeys && apiKeys.length === 0 && (
            <p className="mt-3 text-sm opacity-70">No API keys yet.</p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {apiKeys?.map((apiKey) => (
              <li key={apiKey.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  {apiKey.name} ({apiKey.role === 'OWNER' ? 'Owner' : 'Read only'})
                  <br />
                  <span className="text-sm opacity-70">
                    {apiKey.keyPrefix}… &middot; created {new Date(apiKey.createdAt).toLocaleDateString()}
                    {apiKey.lastUsedAt
                      ? ` · last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`
                      : ' · never used'}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer"
                  onClick={() => revokeApiKey(apiKey.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      </section>
    </>
  );
}
