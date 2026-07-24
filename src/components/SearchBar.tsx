import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useServiceBrowserStore } from '@/store/service-browser'
import { useT } from '@/lib/i18n/client'
import './SearchBar.css'

interface SearchBarProps {
  className?: string
  placeholder?: string
  debounceMs?: number
  disabled?: boolean
  autoFocus?: boolean
}

export const SearchBar: React.FC<SearchBarProps> = ({
  className = '',
  placeholder,
  debounceMs = 300,
  disabled = false,
  autoFocus = false,
}) => {
  const t = useT()
  const effectivePlaceholder = placeholder ?? t('catalog.searchServicesPlaceholder')
  const { searchQuery, setSearchQuery, clearSearch, uiState, searchResultsCount } = useServiceBrowserStore() as any
  const [inputValue, setInputValue] = useState(searchQuery)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const isLoading = !!uiState?.isLoading
  const hasError = !!uiState?.error

  // Sync component state with store when store changes externally
  useEffect(() => {
    setInputValue(searchQuery)
  }, [searchQuery])

  // Handle input changes with debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const value = raw.slice(0, 100)
    setInputValue(value)
    
    // Clear previous timer if it exists
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set new timer for debounce
    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, debounceMs)
  }, [debounceMs, setSearchQuery])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Handle clear button click
  const handleClearClick = useCallback(() => {
    clearSearch()
    
    // Focus input after clearing
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [clearSearch])

  // Handle escape key to clear search
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      clearSearch()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Flush debounce and trigger immediate search
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      setSearchQuery(inputValue)
    }
  }, [clearSearch, inputValue, setSearchQuery])

  return (
    <div
      className={`search-bar ${isFocused ? 'search-bar--focused' : ''} ${
        isLoading ? 'search-bar--loading' : ''
      } ${hasError ? 'search-bar--error' : ''} ${className}`}
      role="search"
    data-testid="search-bar"
    >
      {/* Visually hidden description for accessibility */}
      <p id="search-description" className="sr-only">
        {t('catalog.searchDescription')}
      </p>

      <div className="search-bar__icon-container">
        {isLoading ? (
          <span className="search-bar__spinner" aria-label={t('catalog.searching')} role="status" />
        ) : (
          <svg
            className="search-bar__icon"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label={t('common.search')}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        )}
      </div>

      <input
        ref={inputRef}
        type="search"
        className={`search-bar__input ${isFocused ? 'search-bar__input--focused' : ''}`}
        placeholder={effectivePlaceholder}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled || isLoading}
        aria-label={t('catalog.searchServicesAria')}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck="false"
        aria-invalid={hasError}
        aria-describedby={`search-description${hasError ? ' search-error' : ''}`}
      />

      {inputValue && (
        <button
          type="button"
          className="search-bar__clear-button"
          onClick={handleClearClick}
          aria-label={t('catalog.clearSearch')}
          tabIndex={0}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}

      {hasError && (
        <div id="search-error" className="search-bar__error-message" role="alert" aria-label={t('catalog.searchErrorAria')}>
          {t('catalog.searchFailed')}
        </div>
      )}

      {/* Live region for announcing results count to screen readers when available */}
      {typeof searchResultsCount === 'number' && (
        <div aria-label={t('catalog.searchResultsAria')} aria-live="polite">
          {t('catalog.servicesFoundCount', { count: searchResultsCount })}
        </div>
      )}
    </div>
  )
}