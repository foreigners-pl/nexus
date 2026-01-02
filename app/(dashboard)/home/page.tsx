'use client'

import { useState, useEffect } from 'react'
import { DashboardPanel } from './components/DashboardPanel'
import { SidebarPanel } from './components/SidebarPanel'
import { 
  getAllDashboardData,
  getMyActivities, 
  getUnassignedCases,
  type DashboardData
} from '@/app/actions/dashboard'
import type { User, ActivityLog, Case } from '@/types/database'

interface UnassignedCase extends Case {
  clients?: { first_name?: string; last_name?: string; contact_email?: string }
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export default function HomePage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    const result = await getAllDashboardData()
    if (result.data) {
      setDashboardData(result.data)
    }
    setLoading(false)
  }

  const refreshActivities = async () => {
    const result = await getMyActivities(15)
    if (result.activities && dashboardData) {
      setDashboardData({ ...dashboardData, activities: result.activities })
    }
  }

  const refreshCases = async () => {
    const result = await getUnassignedCases()
    if (result.cases && dashboardData) {
      setDashboardData({ ...dashboardData, unassignedCases: result.cases })
    }
  }

  if (loading || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[hsl(var(--color-primary))] border-t-transparent rounded-full animate-spin" />
          <div className="text-[hsl(var(--color-text-secondary))]">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 pb-4">
        <h1 className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
          {getGreeting()}, <span className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary-hover))] bg-clip-text text-transparent">{dashboardData.user?.display_name || dashboardData.user?.email?.split('@')[0] || 'there'}</span>!
        </h1>
        <p className="text-sm text-[hsl(var(--color-text-secondary))]">
          {formatDate()}
        </p>
      </div>

      {/* Main Content - Fills remaining space */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Dashboard Panel - Main area (2 cols) */}
        <div className="lg:col-span-2 min-h-0">
          <DashboardPanel 
            myCases={dashboardData.myCases}
            myTasks={dashboardData.myTasks}
            myPayments={dashboardData.myPayments}
            myOverdue={dashboardData.myOverdue}
            todayCount={dashboardData.todayCount}
          />
        </div>

        {/* Right Sidebar - Combined Panel */}
        <div className="min-h-0">
          <SidebarPanel 
            activities={dashboardData.activities} 
            cases={dashboardData.unassignedCases} 
            onRefreshActivities={refreshActivities}
            onRefreshCases={refreshCases}
          />
        </div>
      </div>
    </div>
  )
}