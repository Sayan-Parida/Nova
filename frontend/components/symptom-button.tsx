interface SymptomButtonProps {
  name: string
  icon: string
  active: boolean
  onClick: () => void
}

export function SymptomButton({ name, icon, active, onClick }: SymptomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
        active
          ? 'bg-primary/20 border-primary text-primary'
          : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/50'
      }`}
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-xs font-medium">{name}</span>
    </button>
  )
}
