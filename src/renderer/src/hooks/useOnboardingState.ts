import { useCallback, useState } from 'react'

const ONBOARDING_COMPLETED_KEY = 'onboarding-completed'

export function useOnboardingState() {
  // [dev1.0] 默认跳过引导页
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    () => localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true' || true
  )

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
    setOnboardingCompleted(true)
  }, [])

  return {
    onboardingCompleted,
    completeOnboarding
  }
}
