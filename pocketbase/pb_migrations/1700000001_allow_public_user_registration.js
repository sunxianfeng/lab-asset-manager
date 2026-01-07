/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("users");

    // Allow public self-registration.
    // Keep update/delete restricted as defined in the initial migration.
    collection.createRule = "";

    dao.saveCollection(collection);
  },
  (db) => {
    const dao = new Dao(db);
    const collection = dao.findCollectionByNameOrId("users");

    // Revert to admin-only user creation.
    collection.createRule = "@request.auth.id != \"\" && @request.auth.role = \"admin\"";

    dao.saveCollection(collection);
  }
);
