/// <reference path="../pb_data/types.d.ts" />

// ========================================
// Atomic borrow/return logic hooks
// ========================================

// Called when frontend tries to create a lend_record via POST /api/collections/lend_records/records
onRecordCreateRequest((e) => {
  // Extract the record being created from the request body
  const requestBody = e.request.body()
  const assetDescriptionFilter = requestBody.asset_description || ''
  const action = requestBody.action // "lend" or "return"
  const userId = e.auth.id // Current user

  if (!assetDescriptionFilter || !action) {
    throw new BadRequestError('asset_description and action are required')
  }

  // Run everything in a transaction for consistency
  $app.runInTransaction((txApp) => {
    if (action === 'lend') {
      // Check if there's any available asset with this description
      const availableAsset = txApp.findFirstRecordByFilter(
        'assets',
        'asset_description = {:description} && (current_holder = "" || current_holder = null)',
        { description: assetDescriptionFilter }
      )
      if (!availableAsset) {
        throw new BadRequestError('No available asset found with that description')
      }
      // Mark as lent
      availableAsset.set('current_holder', userId)
      txApp.save(availableAsset)
    } else if (action === 'return') {
      // Find an asset currently held by this user with that description
      const heldAsset = txApp.findFirstRecordByFilter(
        'assets',
        'asset_description = {:description} && current_holder = {:user}',
        { description: assetDescriptionFilter, user: userId }
      )
      if (!heldAsset) {
        throw new BadRequestError('No matching borrowed asset found for you')
      }
      // Mark as returned
      heldAsset.set('current_holder', '')
      txApp.save(heldAsset)
    } else {
      throw new BadRequestError('Invalid action. Use "lend" or "return"')
    }

    // If tx succeeds, the record will be created by PB; next() continues default save
  })

  e.next()
}, 'lend_records')

