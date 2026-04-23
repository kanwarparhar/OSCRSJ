import type { Metadata } from 'next'
import PageHeader from '@/components/PageHeader'
import ResetPasswordForm from './ResetPasswordForm'

export const metadata: Metadata = { title: 'Set New Password — OSCRSJ' }

export default function ResetPasswordPage() {
  return (
    <div>
      <PageHeader
        label="Author Portal"
        title="Set New Password"
        subtitle="Choose a new password for your account"
      />
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <ResetPasswordForm />
      </div>
    </div>
  )
}
