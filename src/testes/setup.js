import '@testing-library/jest-dom/vitest'

// O jsdom (navegador simulado dos testes) não implementa scrollTo.
window.scrollTo = vi.fn()
