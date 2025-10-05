import React, { createContext, useContext, useState, useMemo } from 'react'
import FullPageLoader from '../components/FullPageLoader.jsx'

const LoaderContext = createContext({
  show: false,
  setShow: () => {},
  setMessage: () => {},
})

export function LoaderProvider({ children }) {
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('Processing, please wait...')

  const value = useMemo(() => ({ show, setShow, setMessage }), [show, setShow, setMessage])

  return (
    <LoaderContext.Provider value={value}>
      {children}
      <FullPageLoader show={show} message={message} />
    </LoaderContext.Provider>
  )
}

export function useLoader() {
  return useContext(LoaderContext)
}