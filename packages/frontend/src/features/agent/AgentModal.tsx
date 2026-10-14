// AI Agent Transaction Confirmation Modal Component
// Owner: Swayam (Role 4 — Systems Integration, Risk Engine & AI/Crypto Lead)

import React, { useEffect, useRef, useState } from 'react';

export interface AgentProposal {
  action: string;
  recipient: string;
  maxAmount: number;
}

export interface AgentModalProps {
  proposal: AgentProposal | null;
  isOpen: boolean;
  onClose: () => void;
  onAuthorize: (proposal: AgentProposal) => Promise<void>;
}

export function AgentModal({ proposal, isOpen, onClose, onAuthorize }: AgentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && proposal) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen, proposal]);

  if (!isOpen || !proposal) return null;

  async function handleConfirm() {
    if (!proposal || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAuthorize(proposal);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Passkey authorization failed or was cancelled.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="agent-modal-title"
      onCancel={e => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <p className="eyebrow">AI Agent Delegation</p>
      <h2 id="agent-modal-title">Authorize Autonomous Action</h2>
      <p>
        An autonomous AI agent is requesting delegated capability to perform a financial
        transaction on your behalf.
      </p>

      <div style={{ background: '#edf3f0', padding: '16px', borderRadius: '12px', margin: '16px 0' }}>
        <p style={{ margin: '4px 0', fontSize: '14px' }}>
          <strong>Requested Action:</strong> <code>{proposal.action}</code>
        </p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}>
          <strong>Target Recipient:</strong> <code>{proposal.recipient}</code>
        </p>
        <p style={{ margin: '4px 0', fontSize: '14px' }}>
          <strong>Max Bound Ceiling:</strong>{' '}
          <span style={{ color: '#164d45', fontWeight: 700 }}>
            ₹{proposal.maxAmount.toLocaleString()}
          </span>
        </p>
      </div>

      <p className="hint">
        Your passkey creates a single-use, server-bound cryptographic capability token.
        The server enforces that the agent cannot alter the recipient or exceed this amount.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="actions" style={{ marginTop: '24px' }}>
        <button onClick={handleConfirm} disabled={busy}>
          {busy ? 'Verifying passkey…' : 'Approve with Biometric Passkey'}
        </button>
        <button className="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
