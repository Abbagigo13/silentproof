export type BountyCategory = 'fraud' | 'security' | 'policy' | 'legal'
export type SeverityTier = 'critical' | 'high' | 'medium'
export type AppMode = 'submitter' | 'org'
export type ReportStatus = 'pending' | 'confirmed' | 'rejected'

export interface PayoutTiers {
  critical: number
  high: number
  medium: number
}

export interface Bounty {
  id: string
  orgName: string
  title: string
  description: string
  category: BountyCategory
  tiers: PayoutTiers
  poolRemaining: number
  expiryDate: Date
  active: boolean
}

export interface Report {
  id: string
  bountyId: string
  bountyTitle: string
  ipfsCid: string
  tier: SeverityTier
  credibility: number
  summary: string
  category: BountyCategory
  submittedAt: Date
  status: ReportStatus
  payoutAddress: string
}
