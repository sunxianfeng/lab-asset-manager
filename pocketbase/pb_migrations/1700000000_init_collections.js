/// <reference path="../pb_data/types.d.ts" />

migrate(
  (db) => {
    const dao = new Dao(db);

    // In local development it's common to end up with a partially-initialized db
    // (e.g. after a failed start). Drop known collections first to avoid
    // UNIQUE constraint errors on _collections.name.
    const dropIfExists = (nameOrId) => {
      try {
        dao.deleteCollection(dao.findCollectionByNameOrId(nameOrId));
      } catch (_) {}
    };

    // reverse dependency order
    dropIfExists("lend_records");
    dropIfExists("assets");
    dropIfExists("asset_imports");
    dropIfExists("users");

    // users (auth)
    {
      const collection = new Collection({
        id: "usr5c0ll3ct10n1",
        created: "2026-01-06 00:00:00.000Z",
        updated: "2026-01-06 00:00:00.000Z",
        name: "users",
        type: "auth",
        system: false,
        schema: [
          {
            system: false,
            id: "r0l3s3l3ct01",
            name: "role",
            type: "select",
            required: true,
            presentable: true,
            unique: false,
            options: {
              maxSelect: 1,
              values: ["admin", "user"],
            },
          },
        ],
        indexes: [],
        listRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        viewRule: "@request.auth.id != \"\" && (@request.auth.role = \"admin\" || id = @request.auth.id)",
        createRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        updateRule:
          "@request.auth.id != \"\" && (@request.auth.role = \"admin\" || id = @request.auth.id)",
        deleteRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        options: {
          allowEmailAuth: false,
          allowOAuth2Auth: false,
          allowUsernameAuth: true,
          exceptEmailDomains: null,
          manageRule: null,
          minPasswordLength: 8,
          onlyEmailDomains: null,
          requireEmail: false,
        },
      });

      dao.saveCollection(collection);
    }

    // asset_imports
    {
      const collection = new Collection({
        id: "a1mp0rtsc0ll3c",
        created: "2026-01-06 00:00:00.000Z",
        updated: "2026-01-06 00:00:00.000Z",
        name: "asset_imports",
        type: "base",
        system: false,
        schema: [
          {
            system: false,
            id: "s0urc3f1l301",
            name: "source_file",
            type: "file",
            required: true,
            presentable: true,
            unique: false,
            options: {
              maxSelect: 1,
              maxSize: 50 * 1024 * 1024,
              mimeTypes: [
                "text/csv",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ],
              thumbs: [],
              protected: false,
            },
          },
          {
            system: false,
            id: "cr3at3dby01",
            name: "created_by",
            type: "relation",
            required: true,
            presentable: true,
            unique: false,
            options: {
              collectionId: "usr5c0ll3ct10n1",
              cascadeDelete: false,
              maxSelect: 1,
            },
          },
          {
            system: false,
            id: "n0t3st3xt01",
            name: "notes",
            type: "text",
            required: false,
            presentable: false,
            unique: false,
            options: { min: null, max: 2000, pattern: "" },
          },
        ],
        indexes: [],
        listRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        viewRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        createRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        updateRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        deleteRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        options: {},
      });

      dao.saveCollection(collection);
    }

    // assets (unit-level)
    {
      const collection = new Collection({
        id: "a55etsc0ll3ct1",
        created: "2026-01-06 00:00:00.000Z",
        updated: "2026-01-06 00:00:00.000Z",
        name: "assets",
        type: "base",
        system: false,
        schema: [
          { system: false, id: "f1x3d00000001", name: "is_fixed_assets", type: "bool", required: false, presentable: false, unique: false, options: {} },
          { system: false, id: "cat3g0ry000001", name: "category", type: "text", required: false, presentable: true, unique: false, options: { min: null, max: 200, pattern: "" } },
          { system: false, id: "d3scr1pt000001", name: "asset_description", type: "text", required: true, presentable: true, unique: false, options: { min: null, max: 500, pattern: "" } },
          { system: false, id: "s3r1aln000001", name: "serial_no", type: "text", required: false, presentable: true, unique: false, options: { min: null, max: 200, pattern: "" } },
          { system: false, id: "l0cat10n000001", name: "location", type: "text", required: false, presentable: true, unique: false, options: { min: null, max: 200, pattern: "" } },
          { system: false, id: "x1user0000001", name: "excel_user", type: "text", required: false, presentable: false, unique: false, options: { min: null, max: 200, pattern: "" } },
          { system: false, id: "manufac0000001", name: "manufacturer", type: "text", required: false, presentable: true, unique: false, options: { min: null, max: 200, pattern: "" } },
          { system: false, id: "valcny0000001", name: "value_cny", type: "number", required: false, presentable: false, unique: false, options: { min: null, max: null, noDecimal: false } },
          { system: false, id: "commt1m000001", name: "commissioning_time", type: "date", required: false, presentable: false, unique: false, options: { min: "", max: "" } },
          { system: false, id: "metrval0000001", name: "metrology_validity_period", type: "date", required: false, presentable: false, unique: false, options: { min: "", max: "" } },
          { system: false, id: "metreq00000001", name: "metrology_requirement", type: "text", required: false, presentable: false, unique: false, options: { min: null, max: 2000, pattern: "" } },
          { system: false, id: "metcost0000001", name: "metrology_cost", type: "number", required: false, presentable: false, unique: false, options: { min: null, max: null, noDecimal: false } },
          { system: false, id: "remarks0000001", name: "remarks", type: "text", required: false, presentable: false, unique: false, options: { min: null, max: 4000, pattern: "" } },
          { system: false, id: "assetname000001", name: "asset_name", type: "text", required: false, presentable: true, unique: false, options: { min: null, max: 200, pattern: "" } },
          { system: false, id: "gr0upk3y00001", name: "group_key", type: "text", required: true, presentable: true, unique: false, options: { min: null, max: 300, pattern: "" } },
          {
            system: false,
            id: "statussel000001",
            name: "status",
            type: "select",
            required: true,
            presentable: true,
            unique: false,
            options: {
              maxSelect: 1,
              values: ["available", "borrowed"],
            },
          },
          {
            system: false,
            id: "holderrel000001",
            name: "current_holder",
            type: "relation",
            required: false,
            presentable: true,
            unique: false,
            options: {
              collectionId: "usr5c0ll3ct10n1",
              cascadeDelete: false,
              maxSelect: 1,
            },
          },
          {
            system: false,
            id: "importrel000001",
            name: "import_ref",
            type: "relation",
            required: false,
            presentable: false,
            unique: false,
            options: {
              collectionId: "a1mp0rtsc0ll3c",
              cascadeDelete: false,
              maxSelect: 1,
            },
          },
          {
            system: false,
            id: "imagefile000001",
            name: "image",
            type: "file",
            required: false,
            presentable: true,
            unique: false,
            options: {
              maxSelect: 1,
              maxSize: 10 * 1024 * 1024,
              mimeTypes: ["image/*"],
              thumbs: ["100x100", "600x400"],
              protected: false,
            },
          },
        ],
        indexes: [
          "CREATE INDEX idx_assets_group_key ON assets (group_key)",
          "CREATE INDEX idx_assets_group_status ON assets (group_key, status)",
        ],
        listRule: "@request.auth.id != \"\"",
        viewRule: "@request.auth.id != \"\"",
        createRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        updateRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        deleteRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        options: {},
      });

      dao.saveCollection(collection);
    }

    // lend_records
    {
      const collection = new Collection({
        id: "l3ndrec0ll3ct1",
        created: "2026-01-06 00:00:00.000Z",
        updated: "2026-01-06 00:00:00.000Z",
        name: "lend_records",
        type: "base",
        system: false,
        schema: [
          {
            system: false,
            id: "userrel0000001",
            name: "user",
            type: "relation",
            required: true,
            presentable: true,
            unique: false,
            options: {
              collectionId: "usr5c0ll3ct10n1",
              cascadeDelete: false,
              maxSelect: 1,
            },
          },
          {
            system: false,
            id: "actions0000001",
            name: "action",
            type: "select",
            required: true,
            presentable: true,
            unique: false,
            options: { maxSelect: 1, values: ["lend", "return"] },
          },
          {
            system: false,
            id: "groupkey000001",
            name: "asset_group_key",
            type: "text",
            required: true,
            presentable: true,
            unique: false,
            options: { min: null, max: 300, pattern: "" },
          },
          {
            system: false,
            id: "desc000000001",
            name: "asset_description",
            type: "text",
            required: false,
            presentable: true,
            unique: false,
            options: { min: null, max: 500, pattern: "" },
          },
          {
            system: false,
            id: "unitrel0000001",
            name: "asset_unit",
            type: "relation",
            required: false,
            presentable: true,
            unique: false,
            options: {
              collectionId: "a55etsc0ll3ct1",
              cascadeDelete: false,
              maxSelect: 1,
            },
          },
          {
            system: false,
            id: "occur000000001",
            name: "occurred_at",
            type: "date",
            required: false,
            presentable: true,
            unique: false,
            options: { min: "", max: "" },
          },
        ],
        indexes: [
          "CREATE INDEX idx_lend_records_user_time ON lend_records (user, occurred_at)",
          "CREATE INDEX idx_lend_records_group_time ON lend_records (asset_group_key, occurred_at)",
        ],
        listRule:
          "@request.auth.id != \"\" && (@request.auth.role = \"admin\" || user = @request.auth.id)",
        viewRule:
          "@request.auth.id != \"\" && (@request.auth.role = \"admin\" || user = @request.auth.id)",
        createRule:
          "@request.auth.id != \"\" && (@request.auth.role = \"admin\" || user = @request.auth.id)",
        updateRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        deleteRule: "@request.auth.id != \"\" && @request.auth.role = \"admin\"",
        options: {},
      });

      dao.saveCollection(collection);
    }
  },
  (db) => {
    const dao = new Dao(db);

    // reverse order
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId("lend_records"));
    } catch (_) {}
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId("assets"));
    } catch (_) {}
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId("asset_imports"));
    } catch (_) {}
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId("users"));
    } catch (_) {}
  },
);


