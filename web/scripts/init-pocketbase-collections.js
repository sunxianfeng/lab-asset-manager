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
 * 
 * Note: Reads from .env.local file automatically
 */

const PocketBase = require('pocketbase/cjs');
const path = require('path');
const fs = require('fs');

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  console.log('📄 Loading environment variables from .env.local...');
  require('dotenv').config({ path: envPath });
} else {
  console.log('⚠️  .env.local file not found, using environment variables');
}

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

  // Define collections to create (order matters for relations!)
  const collections = [
    // Create asset_imports first so assets can reference it
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
        { name: 'current_holder', type: 'relation', required: false, options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
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
        { name: 'user', type: 'relation', required: true, options: { collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: false } },
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
  ];

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const collectionDef of collections) {
    try {
      // Check if collection already exists
      let existingCollection;
      try {
        existingCollection = await pb.collections.getOne(collectionDef.id);
        console.log(`📋 Collection "${collectionDef.id}" already exists, checking fields...`);
        
        // Debug: log collection structure
        console.log('   Debug: Existing collection keys:', Object.keys(existingCollection));
        console.log('   Debug: Collection name:', existingCollection.name);
        console.log('   Debug: Collection id:', existingCollection.id);
        if (process.env.DEBUG) {
          console.log('   Debug: Collection structure:', JSON.stringify(existingCollection, null, 2));
        }
        
        // Ensure schema exists (initialize as empty array if undefined)
        const existingSchema = existingCollection.schema || existingCollection.fields || [];
        console.log(`   Current schema has ${existingSchema.length} field(s)`);
        
        // Log existing fields to debug
        if (existingSchema.length > 0) {
          console.log('   Existing fields:', existingSchema.map(f => `${f.name} (${f.type})`).join(', '));
        }
        
        // Check if there's a problematic 'id' field (user-created, conflicts with system id)
        const hasIdField = existingSchema.some(f => f.name === 'id');
        if (hasIdField) {
          console.log('   ⚠️  Found problematic "id" field - this conflicts with PocketBase system field');
          console.log('   Please manually delete or rename this field in the PocketBase admin UI');
          console.log('   Admin UI: http://127.0.0.1:8090/_/');
          skipped++;
          continue;
        }
        
        const existingFieldNames = existingSchema.map(f => f.name);
        const missingFields = collectionDef.schema.filter(f => !existingFieldNames.includes(f.name));
        
        if (missingFields.length > 0) {
          console.log(`   Adding ${missingFields.length} missing field(s): ${missingFields.map(f => f.name).join(', ')}`);
          
          // Add unique IDs to new fields if they don't have them
          const fieldsWithIds = missingFields.map(field => ({
            ...field,
            id: field.id || `${field.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }));
          
          // Merge existing schema with new fields
          const updatedSchema = [...existingSchema, ...fieldsWithIds];
          
          try {
            // Use direct HTTP API to avoid SDK adding 'name' field
            const token = pb.authStore.token;
            const response = await fetch(`${pbUrl}/api/collections/${collectionDef.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token,
              },
              body: JSON.stringify({
                type: existingCollection.type,
                fields: updatedSchema,
                indexes: existingCollection.indexes || [],
                listRule: collectionDef.listRule,
                viewRule: collectionDef.viewRule,
                createRule: collectionDef.createRule,
                updateRule: collectionDef.updateRule,
                deleteRule: collectionDef.deleteRule,
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
            }
            
            console.log(`✅ Updated collection "${collectionDef.id}" with new fields`);
            updated++;
          } catch (updateErr) {
            // If batch update fails, try adding fields one by one
            console.log(`   ⚠️  Batch update failed, trying to add fields one by one...`);
            console.log('   Debug: Update error:', JSON.stringify(updateErr, null, 2));
            console.log('   Debug: Error data:', updateErr.data);
            console.log('   Debug: Error response:', updateErr.response);
            
            let successCount = 0;
            let currentSchema = [...existingSchema];
            
            for (const field of missingFields) {
              try {
                // Add unique ID to field if it doesn't have one
                const fieldWithId = {
                  ...field,
                  id: field.id || `${field.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                
                currentSchema.push(fieldWithId);
                console.log(`   Trying to add field "${field.name}" with definition:`, JSON.stringify(fieldWithId, null, 2));
                
                // Use direct HTTP API
                const token = pb.authStore.token;
                const response = await fetch(`${pbUrl}/api/collections/${collectionDef.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token,
                  },
                  body: JSON.stringify({
                    type: existingCollection.type,
                    fields: currentSchema,
                    indexes: existingCollection.indexes || [],
                  }),
                });
                
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
                }
                
                console.log(`   ✅ Added field: ${field.name}`);
                successCount++;
              } catch (fieldErr) {
                console.log(`   ❌ Failed to add field "${field.name}":`, fieldErr.message || fieldErr);
                console.log('   Error details:', JSON.stringify(fieldErr.data, null, 2));
                // Remove the field we just tried to add
                currentSchema = currentSchema.filter(f => f.name !== field.name);
              }
            }
            
            if (successCount > 0) {
              // Update rules after adding fields
              try {
                const token = pb.authStore.token;
                const response = await fetch(`${pbUrl}/api/collections/${collectionDef.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token,
                  },
                  body: JSON.stringify({
                    type: existingCollection.type,
                    indexes: existingCollection.indexes || [],
                    listRule: collectionDef.listRule,
                    viewRule: collectionDef.viewRule,
                    createRule: collectionDef.createRule,
                    updateRule: collectionDef.updateRule,
                    deleteRule: collectionDef.deleteRule,
                  }),
                });
                
                if (response.ok) {
                  console.log(`   ✅ Updated rules for collection "${collectionDef.id}"`);
                } else {
                  const errorData = await response.json();
                  console.log(`   ⚠️  Failed to update rules:`, JSON.stringify(errorData));
                }
              } catch (ruleErr) {
                console.log(`   ⚠️  Failed to update rules:`, ruleErr.message || ruleErr);
              }
              updated++;
            } else {
              throw updateErr; // Re-throw if no fields were added
            }
          }
        } else {
          console.log(`   ℹ️  All fields already exist, updating rules only...`);
          
          // Update rules even if no new fields
          await pb.collections.update(collectionDef.id, {
            listRule: collectionDef.listRule,
            viewRule: collectionDef.viewRule,
            createRule: collectionDef.createRule,
            updateRule: collectionDef.updateRule,
            deleteRule: collectionDef.deleteRule,
          });
          
          console.log(`✅ Updated rules for collection "${collectionDef.id}"`);
          skipped++;
        }
        
        continue;
      } catch (err) {
        // Collection doesn't exist, create it
        if (err.status === 404) {
          // Expected - collection not found
        } else {
          throw err;
        }
      }

      // Create the collection using direct HTTP API
      // Convert 'schema' to 'fields' for PocketBase API
      // Add unique IDs to each field
      const fieldsWithIds = collectionDef.schema.map((field, index) => ({
        ...field,
        id: `field_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }));
      
      const createPayload = {
        id: collectionDef.id,
        name: collectionDef.name,
        type: collectionDef.type,
        fields: fieldsWithIds,
        indexes: [],
        listRule: collectionDef.listRule,
        viewRule: collectionDef.viewRule,
        createRule: collectionDef.createRule,
        updateRule: collectionDef.updateRule,
        deleteRule: collectionDef.deleteRule,
      };
      
      console.log(`   Creating collection with ${createPayload.fields.length} fields...`);
      
      // Debug: Log the actual payload being sent
      if (process.env.DEBUG || collectionDef.id === 'assets') {
        const fs = require('fs');
        fs.writeFileSync(`/tmp/pb-payload-${collectionDef.id}.json`, JSON.stringify(createPayload, null, 2));
        console.log(`   Debug: Payload saved to /tmp/pb-payload-${collectionDef.id}.json`);
      }
      
      // Use direct HTTP API instead of SDK
      const token = pb.authStore.token;
      const response = await fetch(`${pbUrl}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        body: JSON.stringify(createPayload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
      }
      
      console.log(`✅ Created collection: ${collectionDef.id}`);
      created++;
    } catch (err) {
      console.error(`❌ Failed to create/update collection "${collectionDef.id}":`, err.message || err);
      if (err.data) {
        console.error('   Error details:', JSON.stringify(err.data, null, 2));
      }
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   🔄 Updated: ${updated}`);
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
