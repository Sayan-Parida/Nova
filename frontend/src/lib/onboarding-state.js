let onboardingDraft = {
  name: '',
  age: '',
  cycleLength: '',
  lastPeriodDate: '',
}

export function getOnboardingDraft() {
  return onboardingDraft
}

export function updateOnboardingDraft(patch) {
  onboardingDraft = {
    ...onboardingDraft,
    ...patch,
  }
}

export function clearOnboardingDraft() {
  onboardingDraft = {
    name: '',
    age: '',
    cycleLength: '',
    lastPeriodDate: '',
  }
}
