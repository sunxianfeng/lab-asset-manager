/// <reference path="../pb_data/types.d.ts" />

// ========================================
// Prevent non-admin from changing "role"
// ========================================

// This hook runs when any user update request comes in
onRecordUpdateRequest((e) => {
  const authRecord = e.auth
  const oldRecord = e.record
  const requestBody = e.request.body()

  // If "role" field is in the request body and it differs from the old value
  if (requestBody.role !== undefined && requestBody.role !== oldRecord.get('role')) {
    // Only allow superuser or admin (role='admin') to change role
    const isAdmin = authRecord && authRecord.get('role') === 'admin'
    const isSuperuser = e.hasSuperuserAuth()

    if (!isAdmin && !isSuperuser) {
      throw new ForbiddenError('You are not allowed to change the role field')
    }
  }

  e.next()
}, 'users')

