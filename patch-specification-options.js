#!/usr/bin/env node
'use strict';

/**
 * South-West predefined specification options patch.
 * Run from anywhere: node /path/to/patch-specification-options.js
 * The script targets ~/Developer/South-West, creates timestamped backups,
 * verifies all expected source snippets before changing any file, and is idempotent.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(os.homedir(), 'Developer', 'South-West');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const changes = [];

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${rel}`);
  return { file, text: fs.readFileSync(file, 'utf8'), rel };
}

function replaceOnce(rel, before, after, label) {
  const entry = changes.find(x => x.rel === rel) || { ...read(rel), edits: [] };
  if (!changes.includes(entry)) changes.push(entry);

  if (entry.text.includes(after)) {
    // Already patched. Treat as idempotent.
    return;
  }
  const count = entry.text.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${rel}: expected exactly one match for "${label}", found ${count}. No files have been changed.`);
  }
  entry.text = entry.text.replace(before, after);
  entry.edits.push(label);
}

function addMigration() {
  const rel = 'Backend/src/migrations/20261029120000-add-options-to-item-specifications.js';
  const file = path.join(ROOT, rel);
  if (fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (current.includes("addColumn('item_specifications', 'options'")) return;
    throw new Error(`Migration already exists with unexpected contents: ${rel}`);
  }
  changes.push({
    rel, file, text: `'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('item_specifications', 'options', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: []
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('item_specifications', 'options');
  }
};
`, edits: ['create options migration']
  });
}

function apply() {
  if (!fs.existsSync(ROOT)) throw new Error(`Project directory not found: ${ROOT}`);

  // Model
  replaceOnce(
    'Backend/src/models/ItemSpecification.js',
    `            unit: {
                type: DataTypes.STRING(30),
                allowNull: true
            },

            description: {`,
    `            unit: {
                type: DataTypes.STRING(30),
                allowNull: true
            },

            options: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: []
            },

            description: {`,
    'model options field'
  );

  // Controller: accept and return options.
  replaceOnce(
    'Backend/src/controllers/itemSpecificationController.js',
    `    'data_type',
    'unit',
    'description',`,
    `    'data_type',
    'unit',
    'options',
    'description',`,
    'allowed options field'
  );

  replaceOnce(
    'Backend/src/controllers/itemSpecificationController.js',
    `    data_type: specification.data_type,
    unit: specification.unit ?? null,
    description: specification.description ?? null,`,
    `    data_type: specification.data_type,
    unit: specification.unit ?? null,
    options: Array.isArray(specification.options) ? specification.options : [],
    description: specification.description ?? null,`,
    'serialize options'
  );

  replaceOnce(
    'Backend/src/controllers/itemSpecificationController.js',
    `    if (
        body.description !== undefined &&
        body.description !== null &&
        (typeof body.description !== 'string' || body.description.length > 255)
    ) {
        errors.description =
            'Description must be a string of at most 255 characters or null';
    }

    for (const field of ['is_required', 'is_active']) {`,
    `    if (
        body.description !== undefined &&
        body.description !== null &&
        (typeof body.description !== 'string' || body.description.length > 255)
    ) {
        errors.description =
            'Description must be a string of at most 255 characters or null';
    }

    if (body.options !== undefined) {
        if (
            !Array.isArray(body.options) ||
            body.options.length > 100 ||
            body.options.some(option =>
                typeof option !== 'string' ||
                !option.trim() ||
                option.trim().length > 100
            )
        ) {
            errors.options = 'Options must be an array of up to 100 non-empty strings, each at most 100 characters';
        }
    }

    for (const field of ['is_required', 'is_active']) {`,
    'validate options array'
  );

  replaceOnce(
    'Backend/src/controllers/itemSpecificationController.js',
    `            data_type: req.body.data_type ?? 'text',
            unit: req.body.unit?.trim() || null,
            description: req.body.description?.trim() || null,`,
    `            data_type: req.body.data_type ?? 'text',
            unit: req.body.unit?.trim() || null,
            options: (req.body.data_type ?? 'text') === 'select'
                ? [...new Set((req.body.options || []).map(option => option.trim()))]
                : [],
            description: req.body.description?.trim() || null,`,
    'create options'
  );

  replaceOnce(
    'Backend/src/controllers/itemSpecificationController.js',
    `        for (const field of ['unit', 'description']) {
            if (changes[field] !== undefined) {
                changes[field] = changes[field]?.trim() || null;
            }
        }

        transaction = await sequelize.transaction();`,
    `        for (const field of ['unit', 'description']) {
            if (changes[field] !== undefined) {
                changes[field] = changes[field]?.trim() || null;
            }
        }

        if (changes.options !== undefined) {
            changes.options = [...new Set(changes.options.map(option => option.trim()))];
        } else if (changes.data_type === 'select' && specificationTypeNeedsOptionsPlaceholder) {
            changes.options = [];
        }

        transaction = await sequelize.transaction();`,
    'normalize update options'
  );

  // The previous replacement above must not depend on an unknown variable.
  // Replace the deliberately guarded placeholder with a simple safe normalization:
  const controller = changes.find(x => x.rel === 'Backend/src/controllers/itemSpecificationController.js');
  if (controller && controller.text.includes('specificationTypeNeedsOptionsPlaceholder')) {
    controller.text = controller.text.replace(
      `        if (changes.options !== undefined) {
            changes.options = [...new Set(changes.options.map(option => option.trim()))];
        } else if (changes.data_type === 'select' && specificationTypeNeedsOptionsPlaceholder) {
            changes.options = [];
        }`,
      `        if (changes.options !== undefined) {
            changes.options = [...new Set(changes.options.map(option => option.trim()))];
        }`
    );
  }

  // Item-type endpoint returns options to the variant UI.
  replaceOnce(
    'Backend/src/controllers/itemTypeSpecificationController.js',
    `                        'data_type',
                        'unit',
                        'is_required'`,
    `                        'data_type',
                        'unit',
                        'options',
                        'is_required'`,
    'item type endpoint options'
  );

  // Specification form state, load, payload.
  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateSpecification.vue',
    `  data_type: 'text',
  unit: '',
  description: '',`,
    `  data_type: 'text',
  unit: '',
  options: [],
  optionsText: '',
  description: '',`,
    'specification form options state'
  );

  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateSpecification.vue',
    `      data_type: specification.data_type || 'text',
      unit: specification.unit || '',
      description: specification.description || '',`,
    `      data_type: specification.data_type || 'text',
      unit: specification.unit || '',
      options: Array.isArray(specification.options) ? specification.options : [],
      optionsText: Array.isArray(specification.options) ? specification.options.join('\\n') : '',
      description: specification.description || '',`,
    'load options into specification form'
  );

  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateSpecification.vue',
    `    const payload = {
      name: form.value.name.trim(),
      data_type: form.value.data_type,
      unit: form.value.unit.trim() || null,
      description: form.value.description.trim() || null,`,
    `    const options = form.value.data_type === 'select'
      ? [...new Set(form.value.optionsText.split(/\\r?\\n/).map(option => option.trim()).filter(Boolean))]
      : []

    if (form.value.data_type === 'select' && options.length === 0) {
      errorMessage.value = 'Enter at least one predefined option for Select data type.'
      return
    }

    const payload = {
      name: form.value.name.trim(),
      data_type: form.value.data_type,
      unit: form.value.unit.trim() || null,
      options,
      description: form.value.description.trim() || null,`,
    'build options payload'
  );

  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateSpecification.vue',
    `          <!-- Unit -->
          <div class="form-group">`,
    `          <!-- Predefined options for Select -->
          <div v-if="form.data_type === 'select'" class="form-group full-width">
            <label for="specification_options">
              Predefined Options <span>*</span>
            </label>
            <textarea
              id="specification_options"
              v-model="form.optionsText"
              rows="5"
              maxlength="10000"
              placeholder="Enter one option per line, e.g.\\n8GB\\n16GB\\n32GB"
              :disabled="loading"
              required
            ></textarea>
            <small>Enter one option per line. These values appear in a dropdown when creating or editing variants.</small>
          </div>

          <!-- Unit -->
          <div class="form-group">`,
    'insert predefined options textarea'
  );

  // Variant page helper + options mapping + select renderer.
  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateItemVariants.vue',
    `function applySpecificationFields(variant, preserveExisting = true) {`,
    `function normalizeSpecificationOptions(value) {
  if (Array.isArray(value)) {
    return value.map(option => String(option).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map(option => String(option).trim()).filter(Boolean)
    } catch {
      // Older/manual records may contain newline-separated options.
    }
    return value.split(/\\r?\\n/).map(option => option.trim()).filter(Boolean)
  }
  return []
}

function applySpecificationFields(variant, preserveExisting = true) {`,
    'add option normalization helper'
  );

  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateItemVariants.vue',
    `        data_type: spec.data_type || 'text',
        unit: spec.unit || '',
        is_required: Boolean(record.is_required ?? spec.is_required)`,
    `        data_type: spec.data_type || 'text',
        unit: spec.unit || '',
        options: normalizeSpecificationOptions(spec.options),
        is_required: Boolean(record.is_required ?? spec.is_required)`,
    'map specification options'
  );

  replaceOnce(
    'Frontend/Admin/src/pages/products/CreateItemVariants.vue',
    `                  <input
                    v-if="['number', 'decimal'].includes(spec.data_type)"`,
    `                  <select
                    v-if="spec.data_type === 'select' && spec.options.length"
                    :id="\`spec_\${index}_\${spec.id}\`"
                    v-model="variant.attributes[spec.name]"
                    :required="spec.is_required"
                    :disabled="saving || specificationsLoading"
                  >
                    <option value="">Select...</option>
                    <option
                      v-for="option in spec.options"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                  </select>

                  <input
                    v-else-if="['number', 'decimal'].includes(spec.data_type)"`,
    'render predefined select dropdown'
  );

  // Keep all changes staged in memory until every replacement has passed.
  addMigration();

  // Back up and write changed files only after all match checks succeeded.
  for (const change of changes) {
    if (fs.existsSync(change.file)) {
      const backup = `${change.file}.bak-${stamp}`;
      fs.copyFileSync(change.file, backup);
      console.log(`Backup: ${path.relative(ROOT, backup)}`);
    } else {
      fs.mkdirSync(path.dirname(change.file), { recursive: true });
    }
    fs.writeFileSync(change.file, change.text, 'utf8');
    console.log(`${fs.existsSync(change.file) ? 'Updated' : 'Created'}: ${change.rel} (${change.edits.join(', ')})`);
  }

  console.log('\nPatch applied. Next: run the migration, syntax checks, and frontend build.');
}

try {
  apply();
} catch (error) {
  console.error(`\nPATCH STOPPED: ${error.message}`);
  console.error('No project files were written by this run.');
  process.exitCode = 1;
}
