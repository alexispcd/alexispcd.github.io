import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('cairn-theme') === 'dark')

  useEffect(() => {
    document.body.classList.toggle('dark', dark)
    localStorage.setItem('cairn-theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, setDark]
}