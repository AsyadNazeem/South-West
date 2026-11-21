const statusClasses = new Map([
  ['Approved', 'success'],
  ['Completed', 'success'],
  ['Resolved', 'success'],
  ['Under Review', 'warning'],
  ['Evidence Submitted', 'info'],
  ['Rejected', 'danger'],
])

export function badgeClass(status) {
  return statusClasses.get(status) ?? 'neutral'
}
