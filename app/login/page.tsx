import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageHeader from '@/components/PageHeader'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Log In — OSCRSJ' }

export default function LoginPage() {
  return (
    <div>
      <PageHeader
        label="Author Portal"
        title="Sign In"
        subtitle="Access your author dashboard to submit manuscripts and track reviews"
      />
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Suspense fallback={<div className="h-64" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
