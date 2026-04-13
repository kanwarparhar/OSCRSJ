import type { Metadata } from 'next'
import PageHeader from '@/components/PageHeader'
import RegisterForm from './RegisterForm'

export const metadata: Metadata = { title: 'Create an Account — OSCRSJ' }

export default function RegisterPage() {
  return (
    <div>
      <PageHeader
        label="Author Portal"
        title="Create an Account"
        subtitle="Register to submit manuscripts and track your submissions through peer review"
      />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <RegisterForm />
      </div>
    </div>
  )
}
