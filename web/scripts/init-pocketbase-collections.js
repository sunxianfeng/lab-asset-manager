#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Initialize PocketBase collections for lab-asset-manager
 * Usage:
 *   node init-pocketbase-collections.js
 * 
 * Env vars (required):
 *   PB_URL - PocketBase server URL (default: http://127.0.0.1:8090)
 *   PB_ADMIN_EMAIL - Admin email
 *   PB_ADMIN_PASSWORD - Admin password
 */

const PocketBase = require('pocketbase/cjs');

async function main() {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090';
  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('❌ Error: PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables are required.');
    console.error('Usage: PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=yourpassword node init-pocketbase-collections.js');
    process.exit(1);
  }

  console.log(`🔗 Connecting to PocketBase at ${pbUrl}...`);
  const pb = new PocketBase(pbUrl);

  try {
    await pb.admins.authWithPassword(email, password);
    console.log('✅ Admin authenticated successfully\n');
  } catch (err) {
    console.error('❌ Failed to authenticate admin:', err.message || err);
    process.exit(1);
  }

  // Define collections to create
  const collections = [
    {
      id: 'assets',
      name: 'assets',
      type: 'base',
      schema: [
        { name: 'group_key', type: 'text', required: false, options: {} },
        { name: 'asset_description', type: 'text', required: false, options: {} },
        { name: 'asset_name', type: 'text', required: false, options: {} },
        { name: 'serial_no', type: 'text', required: false, options: {} },
        { name: 'category', type: 'text', required: false, options: {} },
        { name: 'location', type: 'text', required: false, options: {} },
        { name: 'excel_user', type: 'text', required: false, options: {} },
        { name: 'manufacturer', type: 'text', required: false, options: {} },
        { name: 'value_cny', type: 'number', required: false, options: {} },
        { name: 'commissioning_time', type: 'date', required: false, options: {} },
        { name: 'metrology_validity_period', type: 'date', required: false, options: {} },
        { name: 'metrology_requirement', type: 'text', required: false, options: {} },
        { name: 'metrology_cost', type: 'number', required: false, options: {} },
        { name: 'remarks', type: 'text', required: false, options: {} },
        { name: 'status', type: 'select', required: false, options: { maxSelect: 1, values: ['available', 'borrowed'] } },
        { name: 'is_fixed_assets', type: 'bool', required: false, options: {} },
        { name: 'current_holder', type: 'relation', required: false, options: { collectionId: 'users', maxSelect: 1, cascadeDelete: false } },
        { name: 'image', type: 'file', required: false, options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], thumbs: ['100x100', '300x300'] } },
        { name: 'import_ref', type: 'relation', required: false, options: { collectionId: 'asset_imports', maxSelect: 1, cascadeDelete: false } },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      id: 'lend_records',
      name: 'lend_records',
      type: 'base',
      schema: [
        { name: 'user', type: 'relation', required: true, options: { collectionId: 'users', maxSelect: 1, cascadeDelete: false } },
        { name: 'asset_group_key', type: 'text', required: false, options: {} },
        { name: 'asset_description', type: 'text', required: false, options: {} },
        { name: 'action', type: 'select', required: true, options: { maxSelect: 1, values: ['lend', 'return'] } },
      ],
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
    {
      id: 'asset_imports',
      name: 'asset_imports',
      type: 'base',
      schema: [
        { name: 'source_file', type: 'file', required: false, options: { maxSelect: 1, maxSize: 52428800, mimeTypes: [] } },
        { name: 'created_by', type: 'text', required: false, options: {} },
        { name: 'notes', type: 'text', required: false, options: {} },
      ],
      listRule: '@request.auth.role = "admin"',
      viewRule: '@request.auth.role = "admin"',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
    },
  ];

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const collectionDef of collections) {
    try {
      // Check if collection already exists
      try {
        await pb.collections.getOne(collectionDef.id);
        console.log(`⏭️  Collection "${collectionDef.id}" already exists, skipping...`);
        skipped++;
        continue;
      } catch (err) {
        // Collection doesn't exist, create it
        if (err.status === 404) {
          // Expected - collection not found
        } else {
          throw err;
        }
      }

      // Create the collection
      await pb.collections.create(collectionDef);
      console.log(`✅ Created collection: ${collectionDef.id}`);
      created++;
    } catch (err) {
      console.error(`❌ Failed to create collection "${collectionDef.id}":`, err);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  if (errors > 0) {
    console.log('\n⚠️  Some collections failed to create. Please check the errors above.');
    process.exit(1);
  }

  console.log('\n🎉 All collections are ready!');
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Ensure you have created an admin user in PocketBase`);
  console.log(`   2. Update users collection to add a "role" field (type: select, values: ["user", "admin"])`);
  console.log(`   3. Start your Next.js app and test the import/export features`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
