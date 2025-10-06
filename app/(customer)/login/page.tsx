import { LoginForm } from '@/components/customer/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#FAFAFA' }}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">DUST</h1>
          <p className="mt-2 text-gray-600">Hair Salon</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
