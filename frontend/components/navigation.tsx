import Link from 'next/link'

interface NavigationProps {
  active: 'dashboard' | 'log' | 'predictions'
}

export function Navigation({ active }: NavigationProps) {
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', key: 'dashboard' },
    { href: '/log', label: 'Log', key: 'log' },
    { href: '/predictions', label: 'Predictions', key: 'predictions' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = active === item.key
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center py-4 px-2 text-xs font-medium border-t-2 transition-colors ${
                  isActive
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
