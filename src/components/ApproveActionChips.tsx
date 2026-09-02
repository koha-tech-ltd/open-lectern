import { useState } from 'react';

export function ApproveActionChips({
  ask,
  onConfirm,
  removeLabel,
  confirmLabel,
  declineLabel,
}: {
  ask: string;
  onConfirm: () => void;
  removeLabel: string;
  confirmLabel: string;
  declineLabel: string;
}) {
  const [pending, setPending] = useState(false);

  if (!pending) {
    return (
      <button
        type="button"
        className="text-xs text-walnut/70 underline-offset-2 hover:underline"
        onClick={() => setPending(true)}
      >
        {removeLabel}
      </button>
    );
  }

  return (
    <div className="approve-chips" role="group" aria-label={ask}>
      <span className="approve-chips-ask">{ask}</span>
      <button type="button" className="approve-chip approve-chip-confirm" onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className="approve-chip approve-chip-decline" onClick={() => setPending(false)}>
        {declineLabel}
      </button>
    </div>
  );
}
