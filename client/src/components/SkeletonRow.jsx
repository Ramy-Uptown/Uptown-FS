import React from 'react'

/**
 * SkeletonRow
 * - Renders a table row with subtle skeleton bars in each cell.
 * - Pass a widths array (e.g., ['sm','lg','sm']) to vary cell bar widths.
 *   'sm' => 60%, 'lg' => 100%, numeric (e.g., 40) => pixels
 */
export default function SkeletonRow({ widths = [], tdStyle }) {
  const barStyle = (w) => {
    let width = '60%'
    if (w === 'lg') width = '100%'
    else if (typeof w === 'number') width = `${w}px`
    return {
      height: 12,
      width,
      background: '#eef2f7',
      borderRadius: 6
    }
  }
  const cellStyle = tdStyle || { padding: 10, borderBottom: '1px solid #f2f5fa' }
  const cols = widths.length || 8
  const arr = widths.length ? widths : Array.from({ length: cols }).map((_, i) => (i % 2 === 0 ? 'sm' : 'lg'))
  return (
    <tr>
      {arr.map((w, i) => (
        <td key={i} style={cellStyle}>
          <div style={barStyle(w)} />
        </td>
      ))}
    </tr>
  )
}