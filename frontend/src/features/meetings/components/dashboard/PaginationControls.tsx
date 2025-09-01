import React, { memo } from 'react'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  startIndex: number
  endIndex: number
  totalItems: number
  itemsPerPage: number
  itemName?: string
  showJumpToPage?: boolean
}

const PaginationControls = memo(function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  startIndex,
  endIndex,
  totalItems,
  itemsPerPage,
  itemName = 'items',
  showJumpToPage = true
}: PaginationControlsProps) {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const handleFirst = () => {
    onPageChange(1)
  }

  const handleLast = () => {
    onPageChange(totalPages)
  }

  const handleJumpToPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(e.target.value)
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      border: '1px solid #e2e8f0'
    }}>
      {/* Statistics */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ 
          fontSize: '14px', 
          color: '#64748b',
          fontWeight: '500'
        }}>
          📊 Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} {itemName}
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: '#6b7280',
          backgroundColor: '#e5e7eb',
          padding: '4px 8px',
          borderRadius: '12px',
          fontWeight: '500'
        }}>
          📄 Page {currentPage} of {totalPages}
        </div>
      </div>

      {/* Navigation Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {/* First Page Button */}
        <button 
          onClick={handleFirst} 
          disabled={currentPage === 1}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
            color: currentPage === 1 ? '#9ca3af' : '#374151',
            borderRadius: '6px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = '#e5e7eb'
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = 'white'
            }
          }}
        >
          ⏮️ First
        </button>

        {/* Previous Button */}
        <button 
          onClick={handlePrevious} 
          disabled={currentPage === 1}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            backgroundColor: currentPage === 1 ? '#f3f4f6' : 'white',
            color: currentPage === 1 ? '#9ca3af' : '#374151',
            borderRadius: '6px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = '#e5e7eb'
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = 'white'
            }
          }}
        >
          ⬅️ Previous
        </button>

        {/* Page Indicator */}
        <div style={{ 
          fontSize: '14px', 
          fontWeight: '600',
          color: '#374151',
          minWidth: '120px',
          textAlign: 'center',
          padding: '8px 16px',
          backgroundColor: '#ffffff',
          border: '2px solid #3b82f6',
          borderRadius: '8px'
        }}>
          Page {currentPage} of {totalPages}
        </div>

        {/* Jump to Page Input (for large page counts) */}
        {showJumpToPage && totalPages > 10 && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <span>Go to:</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={handleJumpToPage}
              style={{
                width: '60px',
                padding: '4px 6px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px',
                textAlign: 'center',
                backgroundColor: 'white'
              }}
            />
          </div>
        )}

        {/* Next Button */}
        <button 
          onClick={handleNext} 
          disabled={currentPage === totalPages}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
            color: currentPage === totalPages ? '#9ca3af' : '#374151',
            borderRadius: '6px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = '#e5e7eb'
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = 'white'
            }
          }}
        >
          Next ➡️
        </button>

        {/* Last Page Button */}
        <button 
          onClick={handleLast} 
          disabled={currentPage === totalPages}
          style={{
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            backgroundColor: currentPage === totalPages ? '#f3f4f6' : 'white',
            color: currentPage === totalPages ? '#9ca3af' : '#374151',
            borderRadius: '6px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = '#e5e7eb'
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = 'white'
            }
          }}
        >
          Last ⏭️
        </button>
      </div>

      {/* Additional Info for Large Lists */}
      {totalItems > 50 && (
        <div style={{
          fontSize: '11px',
          color: '#9ca3af',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          💡 Tip: Use search and filters to find specific {itemName} more quickly
        </div>
      )}
    </div>
  )
})

export default PaginationControls
