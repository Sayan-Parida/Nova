interface SymptomButtonProps {
  name: string
  active: boolean
  onClick: () => void
}

export function SymptomButton({ name, active, onClick }: SymptomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-full border text-sm font-medium transition-colors ${
        active
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-card border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {name}
    </button>
  )
}
