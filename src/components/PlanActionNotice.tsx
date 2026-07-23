import type { PlanActionNotice as Notice } from '../lib/useHouseholdPlanActions'

interface Props {
  notice: Notice | null
  onUndo: () => Promise<void>
}

export function PlanActionNotice({ notice, onUndo }: Props) {
  if (!notice) return null
  return (
    <div className="mb-3 rounded-2xl bg-surface p-3 text-sm text-gold" role="status">
      <p>{notice.message}</p>
      {notice.copyIds.length > 0 && (
        <button
          type="button"
          onClick={() => void onUndo()}
          className="mt-1 font-bold text-accent underline"
        >
          Deshacer para el resto
        </button>
      )}
    </div>
  )
}
