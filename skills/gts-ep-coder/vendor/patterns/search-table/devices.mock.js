export const devices = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `Server-${String(index + 1).padStart(2, '0')}`,
  status: index % 3 ? 'enabled' : 'disabled',
  updatedAt: '2026-01-01 09:00',
}))
