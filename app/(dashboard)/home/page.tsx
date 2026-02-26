'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardPanel } from './components/DashboardPanel'
import { SidebarPanel } from './components/SidebarPanel'
import { 
  getEssentialDashboardData,
  getMyCasesData,
  getMyTasksData,
  getMyPaymentsData,
  getMyOverdueData,
  getMyActivities, 
  getUnassignedCases,
  type DashboardData
} from '@/app/actions/dashboard'
import { useDashboardCache } from '@/lib/query'
import { createClient } from '@/lib/supabase/client'
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

// Track which data has been prefetched to avoid duplicate fetches
const prefetchedTabs = new Set<string>()

export default function HomePage() {
  const { getCached: getCachedDashboard, setCached: setCachedDashboard } = useDashboardCache()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(() => null)
  const [loading, setLoading] = useState(true)
  const [tabsLoaded, setTabsLoaded] = useState(false)

  // Load essential data first (visible content), then background load the rest
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    // Check cache first
    const cached = getCachedDashboard()
    if (cached?.data) {
      setDashboardData(cached.data)
      setLoading(false)
      setTabsLoaded(true)
      // Background refresh
      refreshAllData()
      return
    }
    
    // PHASE 1: Load essential data FAST (what user sees first)
    setLoading(true)
    const essential = await getEssentialDashboardData()
    
    if (essential.data) {
      // Show UI immediately with essential data + empty placeholders for tabs
      setDashboardData({
        user: essential.data.user,
        activities: essential.data.activities,
        unassignedCases: essential.data.unassignedCases,
        myCases: [],
        myTasks: [],
        myPayments: [],
        myOverdue: { cases: [], tasks: [], payments: [] },
        todayCount: essential.data.todayCount,
        todayCounts: essential.data.todayCounts
      })
      setLoading(false)
      
      // PHASE 2: Load tab data in background (not blocking UI)
      loadBackgroundData()
    }
  }

  async function loadBackgroundData() {
    // Load all secondary data in parallel
    const [casesResult, tasksResult, paymentsResult, overdueResult] = await Promise.all([
      getMyCasesData(),
      getMyTasksData(),
      getMyPaymentsData(),
      getMyOverdueData()
    ])

    setDashboardData(prev => {
      if (!prev) return prev
      const updated = {
        ...prev,
        myCases: casesResult.myCases || [],
        myTasks: tasksResult.myTasks || [],
        myPayments: paymentsResult.myPayments || [],
        myOverdue: overdueResult.myOverdue || { cases: [], tasks: [], payments: [] }
      }
      // Cache the complete data
      setCachedDashboard({ data: updated })
      return updated
    })
    
    // Mark all as prefetched
    prefetchedTabs.add('cases')
    prefetchedTabs.add('tasks')
    prefetchedTabs.add('payments')
    prefetchedTabs.add('overdue')
    setTabsLoaded(true)
  }

  async function refreshAllData() {
    const [essential, casesResult, tasksResult, paymentsResult, overdueResult] = await Promise.all([
      getEssentialDashboardData(),
      getMyCasesData(),
      getMyTasksData(),
      getMyPaymentsData(),
      getMyOverdueData()
    ])

    if (essential.data) {
      const updated = {
        user: essential.data.user,
        activities: essential.data.activities,
        unassignedCases: essential.data.unassignedCases,
        myCases: casesResult.myCases || [],
        myTasks: tasksResult.myTasks || [],
        myPayments: paymentsResult.myPayments || [],
        myOverdue: overdueResult.myOverdue || { cases: [], tasks: [], payments: [] },
        todayCount: essential.data.todayCount,
        todayCounts: essential.data.todayCounts
      }
      setDashboardData(updated)
      setCachedDashboard({ data: updated })
    }
  }

  // Prefetch data when hovering over tabs
  const prefetchTab = useCallback(async (tabId: string) => {
    if (prefetchedTabs.has(tabId)) return
    prefetchedTabs.add(tabId)
    
    switch (tabId) {
      case 'cases':
        const casesResult = await getMyCasesData()
        setDashboardData(prev => prev ? { ...prev, myCases: casesResult.myCases || [] } : prev)
        break
      case 'tasks':
        const tasksResult = await getMyTasksData()
        setDashboardData(prev => prev ? { ...prev, myTasks: tasksResult.myTasks || [] } : prev)
        break
      case 'payments':
        const paymentsResult = await getMyPaymentsData()
        setDashboardData(prev => prev ? { ...prev, myPayments: paymentsResult.myPayments || [] } : prev)
        break
      case 'overdue':
        const overdueResult = await getMyOverdueData()
        setDashboardData(prev => prev ? { ...prev, myOverdue: overdueResult.myOverdue || { cases: [], tasks: [], payments: [] } } : prev)
        break
    }
  }, [])

  // Real-time subscription for activity updates
  useEffect(() => {
    if (!dashboardData?.user?.id) return

    const supabase = createClient()
    const userId = dashboardData.user.id
    
    const channel = supabase
      .channel('home-activity-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log'
        },
        (payload) => {
          // Filter client-side to ensure we only handle our activities
          const newActivity = payload.new as ActivityLog
          if (newActivity.user_id === userId) {
            // Add the new activity to the top of the list
            setDashboardData(prev => {
              if (!prev) return prev
              // Check if activity already exists to avoid duplicates
              const exists = prev.activities.some(a => a.id === newActivity.id)
              if (exists) return prev
              return {
                ...prev,
                activities: [newActivity, ...prev.activities].slice(0, 15)
              }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dashboardData?.user?.id])

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
    // Show UI shell with skeleton placeholders - NOT a blank loading screen
    return (
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Header Skeleton */}
        <div className="flex-shrink-0 pb-4 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-[hsl(var(--color-primary))]/20 backdrop-blur-sm border border-[hsl(var(--color-primary))]/30">
            <svg className="w-6 h-6 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <div className="h-8 w-48 bg-[hsl(var(--color-surface-hover))] rounded animate-pulse" />
            <div className="h-4 w-32 bg-[hsl(var(--color-surface-hover))] rounded animate-pulse mt-2" />
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Dashboard Panel Skeleton */}
          <div className="lg:col-span-2 min-h-0">
            <div className="h-full bg-[hsl(var(--color-card))] rounded-xl border border-[hsl(var(--color-border))] p-4">
              {/* Tab buttons skeleton */}
              <div className="flex gap-2 mb-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-10 w-24 bg-[hsl(var(--color-surface-hover))] rounded-lg animate-pulse" />
                ))}
              </div>
              {/* Content area skeleton */}
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-16 bg-[hsl(var(--color-surface-hover))] rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="min-h-0">
            <div className="h-full bg-[hsl(var(--color-card))] rounded-xl border border-[hsl(var(--color-border))] p-4">
              <div className="flex gap-2 mb-4">
                <div className="h-8 w-20 bg-[hsl(var(--color-surface-hover))] rounded animate-pulse" />
                <div className="h-8 w-20 bg-[hsl(var(--color-surface-hover))] rounded animate-pulse" />
              </div>
              <div className="space-y-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-12 bg-[hsl(var(--color-surface-hover))] rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 pb-4 flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-[hsl(var(--color-primary))]/20 backdrop-blur-sm border border-[hsl(var(--color-primary))]/30 shadow-[0_0_20px_hsl(var(--color-primary)/0.2)]">
          <svg className="w-6 h-6 text-[hsl(var(--color-primary))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
            {getGreeting()}, <span className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary-hover))] bg-clip-text text-transparent">{dashboardData.user?.display_name || dashboardData.user?.email?.split('@')[0] || 'there'}</span>
          </h1>
          <p className="text-sm text-[hsl(var(--color-text-secondary))] mt-0.5">
            {formatDate()}
          </p>
        </div>
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
            todayCounts={dashboardData.todayCounts}
            onPrefetchTab={prefetchTab}
            tabsLoaded={tabsLoaded}
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