import React, { useState, useEffect, useRef } from 'react'

interface InputModalProps {
  isOpen: boolean
  title: string
  placeholder: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

const isMobile = () => window.innerWidth < 768

export default function InputModal({
  isOpen,
  title,
  placeholder,
  defaultValue = '',
  onConfirm,
  onCancel
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      // Focus the input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 100)
    }
  }, [isOpen, defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedValue = value.trim()
    if (trimmedValue) {
      onConfirm(trimmedValue)
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: isMobile() ? '20px' : '24px',
        maxWidth: isMobile() ? '90%' : '400px',
        width: isMobile() ? '90%' : '90%',
        margin: isMobile() ? '20px' : '0',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: isMobile() ? '16px' : '18px',
          fontWeight: '600',
          color: '#1f2937'
        }}>
          {title}
        </h3>
        
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{
              width: '100%',
              padding: isMobile() ? '10px 14px' : '12px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: isMobile() ? '16px' : '14px', // 16px prevents zoom on iOS
              marginBottom: '20px',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb'
            }}
          />
          
          <div style={{
            display: 'flex',
            gap: isMobile() ? '8px' : '12px',
            justifyContent: 'flex-end',
            flexDirection: isMobile() ? 'column-reverse' : 'row'
          }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: isMobile() ? '12px 20px' : '10px 20px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: isMobile() ? '16px' : '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: isMobile() ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              style={{
                padding: isMobile() ? '12px 20px' : '10px 20px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: isMobile() ? '16px' : '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: isMobile() ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
