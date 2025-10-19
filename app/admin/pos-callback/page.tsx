'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function POSCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'canceled'>('processing')
  const [message, setMessage] = useState('Processing payment...')

  useEffect(() => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const data = urlParams.get('data')
    
    if (data) {
      try {
        const transactionInfo = JSON.parse(decodeURIComponent(data))
        
        if (transactionInfo.error_code) {
          // Payment was canceled or failed
          if (transactionInfo.error_code === 'payment_canceled') {
            setStatus('canceled')
            setMessage('Payment was canceled - returning to admin panel')
          } else {
            setStatus('error')
            setMessage(`Payment failed: ${transactionInfo.error_code}`)
          }
        } else if (transactionInfo.transaction_id) {
          // Payment was successful
          setStatus('success')
          setMessage('Payment completed successfully!')
        }
      } catch {
        setStatus('error')
        setMessage('Invalid payment response')
      }
    } else {
      setStatus('canceled')
      setMessage('Payment was canceled - returning to admin panel')
    }

    // Redirect back to admin panel immediately for cancellations, 3 seconds for success
    const redirectDelay = status === 'canceled' ? 1000 : 3000
    setTimeout(() => {
      // Close the tab if it was opened in a new tab, otherwise redirect
      if (window.opener) {
        window.close()
      } else {
        router.push('/admin/bookings')
      }
    }, redirectDelay)
  }, [router, status])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <div className="mb-4">
          {status === 'processing' && (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          )}
          {status === 'success' && (
            <div className="text-green-600 text-6xl">✓</div>
          )}
          {status === 'error' && (
            <div className="text-red-600 text-6xl">✗</div>
          )}
          {status === 'canceled' && (
            <div className="text-yellow-600 text-6xl">⚠</div>
          )}
        </div>
        
        <h2 className="text-xl font-semibold mb-2">
          {status === 'processing' && 'Processing Payment...'}
          {status === 'success' && 'Payment Successful!'}
          {status === 'error' && 'Payment Failed'}
          {status === 'canceled' && 'Payment Canceled'}
        </h2>
        
        <p className="text-gray-600 mb-4">{message}</p>
        
        <p className="text-sm text-gray-500">
          Redirecting back to admin panel...
        </p>
      </div>
    </div>
  )
}
