import type { Metadata } from 'next'
import PageHeader from '@/components/PageHeader'
import ForgotPasswordForm from './ForgotPasswordForm'

export const metadata: Metadata = { title: 'Reset Password — OSCRSJ' }

export default function ForgotPasswordPage() {
  return (
    <div>
      <PageHeader
        label="Author Portal"
        title="Reset Password"
        subtitle="Enter your email address and we will send you a reset link"
      />
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
