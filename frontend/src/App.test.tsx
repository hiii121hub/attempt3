import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the remote browser shell', () => {
    render(<App />)

    expect(screen.getByText(/remote browser poc/i)).toBeTruthy()
    expect(screen.getByText(/loading novnc/i)).toBeTruthy()
  })
})
