import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ihbc-theme') as Theme) || 'light');
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('ihbc-theme', theme); }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  return <button type="button" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>;
}