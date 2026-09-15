import type { Language, ThemeMode } from '@shared/types'
import { Button } from '@/components/ui/button'
import { MoonIcon, SunIcon, WebIcon } from '../icons'
import { useStore } from '../store'
import { useT } from '../i18n'

const THEMES: { value: ThemeMode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', label: '浅色', Icon: SunIcon },
  { value: 'dark', label: '深色', Icon: MoonIcon },
  { value: 'system', label: '跟随系统', Icon: WebIcon }
]

/**
 * Theme and language, pinned to the bottom-right of every screen so they are
 * reachable without opening settings.
 */
export function QuickPrefs(): React.JSX.Element {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const theme = settings?.theme ?? 'system'
  const lang: Language = settings?.language ?? 'zh'

  return (
    <div className="fixed right-4 bottom-4 z-40 flex items-center gap-0.5 rounded-lg border border-border bg-popover/90 p-0.5 shadow-sm backdrop-blur">
      {THEMES.map(({ value, label, Icon }) => (
        <Button
          key={value}
          variant={theme === value ? 'secondary' : 'ghost'}
          size="icon-sm"
          title={t(label)}
          aria-pressed={theme === value}
          onClick={() => void setTheme(value)}
        >
          <Icon />
        </Button>
      ))}
      <span className="mx-0.5 h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="sm"
        className="px-2 text-xs"
        title={t('语言')}
        onClick={() => void setLanguage(lang === 'zh' ? 'en' : 'zh')}
      >
        {lang === 'zh' ? 'EN' : '中'}
      </Button>
    </div>
  )
}
