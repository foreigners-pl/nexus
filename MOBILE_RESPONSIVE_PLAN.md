# Mobile Responsive Implementation Plan

**Backup commit:** `e437889` (can rollback with `git reset --hard e437889`)

---

## Phase 1: Foundation (Do First)
- [ ] **Navbar** - Add hamburger menu for mobile, hide sidebar links on small screens
- [ ] **Layout** - Ensure dashboard layout stacks properly, sidebar becomes drawer/overlay
- [ ] **Global CSS** - Add any mobile-specific utility classes if needed

## Phase 2: List Pages (High Impact)
- [ ] **Clients List** - Table → Card list on mobile (show key info, hide columns)
- [ ] **Cases List** - Table → Card list on mobile
- [ ] **Home Dashboard** - Stack stat cards vertically, adjust grid

## Phase 3: Detail Pages
- [ ] **Client Detail Page** - Stack two-column layout, collapsible sections
- [ ] **Case Detail Page** - Stack sections vertically, tabs or accordion for sections
- [ ] **PaymentPanel** - Make installment rows stack, touch-friendly dropdowns

## Phase 4: Complex Components (Most Work)
- [ ] **Kanban Board** - Horizontal scroll OR single column view with column switcher
- [ ] **Modals** - Full-screen on mobile, better touch targets
- [ ] **Dropdowns/Menus** - Larger touch targets, bottom sheet style on mobile

## Phase 5: Forms & Inputs
- [ ] **All Forms** - Stack fields vertically, full-width inputs
- [ ] **Date Pickers** - Ensure native mobile date pickers work well
- [ ] **Select Dropdowns** - Touch-friendly sizing

## Phase 6: Polish
- [ ] **Touch Targets** - Minimum 44px tap targets for all buttons
- [ ] **Spacing** - Adjust padding/margins for mobile
- [ ] **Typography** - Ensure readable font sizes
- [ ] **Testing** - Test on actual devices / browser dev tools

---

## Key Tailwind Breakpoints
```
sm: 640px   - Small tablets, large phones landscape
md: 768px   - Tablets
lg: 1024px  - Small laptops
xl: 1280px  - Desktops
```

## Common Patterns to Use
```tsx
// Stack on mobile, row on desktop
className="flex flex-col md:flex-row"

// Hide on mobile
className="hidden md:block"

// Show only on mobile
className="block md:hidden"

// Full width on mobile, auto on desktop
className="w-full md:w-auto"

// Grid responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

## Files to Touch (by priority)
1. `components/layout/Navbar.tsx`
2. `app/(dashboard)/layout.tsx`
3. `app/(dashboard)/clients/page.tsx`
4. `app/(dashboard)/cases/page.tsx`
5. `app/(dashboard)/home/page.tsx`
6. `app/(dashboard)/clients/[id]/page.tsx`
7. `app/(dashboard)/cases/[id]/page.tsx`
8. `app/(dashboard)/cases/[id]/components/PaymentPanel.tsx`
9. `app/(dashboard)/board/components/KanbanBoard.tsx`
10. `components/ui/Modal.tsx`
