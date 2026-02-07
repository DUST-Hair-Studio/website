import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Navigation } from '@/components/navigation'

export const metadata = {
  title: 'Privacy Policy | DUST Hair Studio',
  description: 'Privacy policy for DUST Hair Studio booking and services.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2">← Back</Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2025</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">1. Information We Collect</h2>
            <p>
              When you book an appointment, join our waitlist, or contact us, we may collect:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and phone number</li>
              <li>Appointment preferences (service, date, time)</li>
              <li>Payment-related information (processed by our payment provider; we do not store full card numbers)</li>
              <li>Account credentials if you create an account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">2. How We Use It</h2>
            <p>
              We use your information to: confirm and manage appointments, send reminders and confirmations,
              process payments, improve our services, and communicate with you about your visit. We may use
              email to send appointment-related messages and, with your consent, occasional updates or offers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">3. Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with: service providers who help us
              run our business (e.g., hosting, email delivery, payment processing, calendar sync); and when
              required by law or to protect our rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">4. Data Retention & Security</h2>
            <p>
              We retain your information as long as needed for appointments, billing, and legal obligations.
              We use reasonable measures to protect your data; no system is completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">5. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data by contacting us.
              You can opt out of marketing emails at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">6. Contact</h2>
            <p>
              For privacy questions or requests, contact us at the business email or address listed on our website.
            </p>
          </section>
        </div>
      </main>
      <footer className="text-white py-8 mt-auto" style={{ backgroundColor: '#1C1C1D' }}>
        <div className="container max-w-3xl mx-auto px-4 text-center text-sm">
          <Link href="/" className="underline hover:no-underline">DUST Hair Studio</Link>
          {' · '}
          <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link>
        </div>
      </footer>
    </div>
  )
}
