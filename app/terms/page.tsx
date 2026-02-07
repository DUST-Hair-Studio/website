import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Navigation } from '@/components/navigation'

export const metadata = {
  title: 'Terms of Service | DUST Hair Studio',
  description: 'Terms of service for DUST Hair Studio booking and services.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2">← Back</Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 2025</p>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">1. Acceptance</h2>
            <p>
              By using our website, booking appointments, or using our services, you agree to these terms.
              If you do not agree, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">2. Appointments & Booking</h2>
            <p>
              Appointments are subject to availability. You are responsible for providing accurate contact
              information and showing up at the scheduled time. We may send reminders; failure to receive them
              does not relieve you of your appointment. Booking may be subject to a booking start date or
              other schedule rules we publish.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">3. Cancellation & No-Shows</h2>
            <p>
              Please cancel or reschedule with reasonable notice as specified by our policy (e.g., 24–48 hours).
              We may charge a fee or restrict future booking for repeated no-shows or late cancellations, as
              stated in our cancellation policy at the time of booking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">4. Payment</h2>
            <p>
              Payment terms (e.g., at time of service, deposit, or prepayment) will be communicated at
              booking or at the studio. Prices and methods are subject to change. Refunds are handled
              according to our stated policy at the time of purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">5. Services</h2>
            <p>
              We provide the services described on our site and in our communications. Results may vary.
              We are not liable for outcomes beyond our control. You agree to communicate any allergies,
              sensitivities, or health concerns relevant to the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">6. Use of the Site</h2>
            <p>
              You agree to use our website and booking system only for lawful purposes. You may not
              misuse the system, attempt to gain unauthorized access, or interfere with other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">7. Limitation of Liability</h2>
            <p>
              To the extent permitted by law, DUST Hair Studio and its operators are not liable for
              indirect, incidental, or consequential damages arising from your use of our services or
              website. Our total liability is limited to the amount you paid for the service in question.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">8. Changes</h2>
            <p>
              We may update these terms from time to time. The “Last updated” date at the top will change.
              Continued use of our services after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-2">9. Contact</h2>
            <p>
              For questions about these terms, contact us at the business email or address on our website.
            </p>
          </section>
        </div>
      </main>
      <footer className="text-white py-8 mt-auto" style={{ backgroundColor: '#1C1C1D' }}>
        <div className="container max-w-3xl mx-auto px-4 text-center text-sm">
          <Link href="/" className="underline hover:no-underline">DUST Hair Studio</Link>
          {' · '}
          <Link href="/privacy" className="underline hover:no-underline">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  )
}
