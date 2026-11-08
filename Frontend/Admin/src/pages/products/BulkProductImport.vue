<script setup>
import { computed, ref } from 'vue'
import api from '@/api/axios'

const file=ref(null),importId=ref(''),preview=ref(null),busy=ref(false),stage=ref('ready'),message=ref(''),result=ref(null)
const invalidRows=computed(()=>preview.value?.rows?.filter(row=>row.status==='Invalid')||[])
const hasBlockingErrors=computed(()=>invalidRows.value.length>0||(preview.value?.workbookErrors?.length||0)>0)
const addedProducts=computed(()=>result.value?.results?.filter(row=>row.status==='Imported')||[])
const failedProducts=computed(()=>result.value?.results?.filter(row=>row.status!=='Imported')||[])
function chooseFile(event){file.value=event.target.files?.[0]||null;preview.value=null;result.value=null;importId.value='';message.value=''}
function saveBlob(blob,name){const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url)}
async function downloadTemplate(){busy.value=true;try{const response=await api.get('/product-import/template',{responseType:'blob'});saveBlob(response.data,'south-west-product-import-template.xlsx')}catch(error){message.value=error.response?.data?.message||'Could not download the template.'}finally{busy.value=false}}
async function upload(){if(!file.value)return;busy.value=true;stage.value='validating';message.value='Checking the workbook…';const body=new FormData();body.append('file',file.value);try{const response=await api.post('/product-import/validate',body,{headers:{'Content-Type':'multipart/form-data'}});preview.value=response.data;importId.value=response.data.importId;stage.value='preview';message.value='Workbook checked. Review the results below.'}catch(error){message.value=error.response?.data?.message||'Could not check the workbook.';stage.value='ready'}finally{busy.value=false}}
async function downloadErrors(){try{const response=await api.get(`/product-import/${importId.value}/errors`,{responseType:'blob'});saveBlob(response.data,'product-import-errors.xlsx')}catch(error){message.value=error.response?.data?.message||'Could not download the error report.'}}
async function confirmImport(){if(!window.confirm(`Import all ${preview.value.counts.products} products and their variants?`))return;busy.value=true;stage.value='importing';message.value='Importing products and variants…';try{const response=await api.post(`/product-import/${importId.value}/confirm`,{confirm:true});result.value=response.data;stage.value='complete';message.value='Import processing complete.'}catch(error){message.value=error.response?.data?.message||'Import failed.';stage.value='preview'}finally{busy.value=false}}
async function retryFailed(){busy.value=true;stage.value='importing';message.value='Retrying products that failed to save…';try{const response=await api.post(`/product-import/${importId.value}/confirm`,{confirm:true,retry:true});result.value=response.data;stage.value='complete';message.value='Retry processing complete.'}catch(error){message.value=error.response?.data?.message||'Retry failed.';stage.value='complete'}finally{busy.value=false}}
</script>

<template>
  <main class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Bulk Product Import</h1>

        <p>
          Add products and their variants from one Excel workbook.
          Product codes and variant SKUs are created automatically.
        </p>
      </div>
    </div>


    <!-- Steps -->
    <ol class="steps">
      <li>Get the template</li>
      <li>Fill Products</li>
      <li>Add Variants</li>
      <li :class="{ current: ['validating', 'preview'].includes(stage) }">Upload and review</li>
      <li :class="{ current: ['importing', 'complete'].includes(stage) }">Confirm and finish</li>
      <li>Add specifications in admin</li>
    </ol>


    <!-- Status message -->
    <div v-if="message" class="notice" role="status">
      {{ message }}
    </div>


    <!-- 1. Template -->
    <section class="card">
      <div class="section-number">1</div>

      <div class="section-body">
        <h2>Download the Excel template</h2>

        <p>
          It includes separate sheets for Products and Variants. Reference Lists shows current categories,
          brands, item types, units, warranties, conditions, and stock locations.
        </p>

        <button
            class="primary-button"
            type="button"
            :disabled="busy"
            @click="downloadTemplate"
        >
          Download Excel template
        </button>
      </div>
    </section>


    <!-- 2. Instructions -->
    <section class="card">
      <div class="section-number">2</div>

      <div class="section-body">
        <h2>Fill in the workbook</h2>

        <ul class="plain-list">
          <li>Add each product once on <strong>Products</strong>. Choose Unit of Measure, Warranty, and Condition from the lists, and enter Shipping Weight in kilograms.</li>
          <li>Add at least one row for each product on <strong>Variants</strong>. Enter a selling price and all four checkout prices for each variant. QuickBooks Item Code is optional text for that variant.</li>
          <li>Enter a non-negative Reorder Quantity for each variant. It accepts zero and up to three decimal places. Enter Stock Quantity separately for opening stock.</li>
          <li>Choose an active Stock Location when Stock Quantity or Reorder Quantity is greater than zero. The preview shows the location and reorder quantity for each variant.</li>
          <li>Mark one variant as the default, or leave all as No to use the first variant.</li>
          <li>After the import, open <strong>Products &gt; Variants</strong>, edit each variant, and add its configured specifications there.</li>
        </ul>
      </div>
    </section>


    <!-- 3. Upload -->
    <section class="card">
      <div class="section-number">3</div>

      <div class="section-body">
        <h2>Upload and check the workbook</h2>

        <p>
          Choose your completed .xlsx file (up to 10 MB). Everything is checked before products are added.
        </p>

        <div class="upload-row">
          <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              @change="chooseFile"
          >

          <button
              class="primary-button"
              type="button"
              :disabled="!file || busy"
              @click="upload"
          >
            {{ busy && stage === 'validating' ? 'Checking workbook…' : 'Upload and check' }}
          </button>
        </div>

        <progress
            v-if="busy"
            max="100"
            :value="stage === 'validating' ? 55 : stage === 'importing' ? 80 : 100"
            aria-label="Processing progress"
        ></progress>
      </div>
    </section>


    <template v-if="preview">

      <!-- 4. Review -->
      <section class="card">
        <div class="section-number">4</div>

        <div class="section-body">

          <div class="card-heading">
            <div>
              <h2>Review the check results</h2>

              <p>
                Fix all issues in the workbook, then upload it again.
                Products cannot be imported while errors remain.
              </p>
            </div>

            <button
                v-if="hasBlockingErrors"
                class="secondary-button"
                type="button"
                @click="downloadErrors"
            >
              Download error report
            </button>
          </div>


          <!-- Counts -->
          <div class="stats">
            <div>
              <b>{{ preview.counts.products }}</b>
              <span>Products</span>
            </div>

            <div>
              <b>{{ preview.counts.variants }}</b>
              <span>Variants</span>
            </div>

            <div class="stat-good">
              <b>{{ preview.counts.valid }}</b>
              <span>Ready</span>
            </div>

            <div :class="{ 'stat-bad': preview.counts.invalid + (preview.workbookErrors?.length ? 1 : 0) > 0 }">
              <b>{{ preview.counts.invalid + (preview.workbookErrors?.length ? 1 : 0) }}</b>
              <span>Needs attention</span>
            </div>
          </div>


          <!-- Workbook errors -->
          <div v-if="preview.workbookErrors?.length" class="table-wrap">
            <table>
              <thead>
              <tr>
                <th>Worksheet</th>
                <th>Excel row</th>
                <th>Column</th>
                <th>What needs fixing</th>
                <th>Suggested correction</th>
              </tr>
              </thead>

              <tbody>
              <tr
                  v-for="issue in preview.workbookErrors"
                  :key="`${issue.sheet}-${issue.rowNumber}-${issue.column}-${issue.error}`"
              >
                <td>{{ issue.sheet }}</td>
                <td>{{ issue.rowNumber }}</td>
                <td>{{ issue.column }}</td>
                <td class="problem">{{ issue.error }}</td>
                <td>{{ issue.suggestion }}</td>
              </tr>
              </tbody>
            </table>
          </div>


          <!-- Products checked -->
          <h3>Products checked</h3>

          <div class="table-wrap">
            <table>
              <thead>
              <tr>
                <th>Product row</th>
                <th>Product</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Unit</th>
                <th>Warranty</th>
                <th>Condition</th>
                <th>Shipping weight (kg)</th>
                <th>Mark as New</th>
                <th>Variants</th>
                <th>Check</th>
              </tr>
              </thead>

              <tbody>
              <tr v-for="row in preview.rows" :key="row.rowNumber">
                <td>{{ row.rowNumber }}</td>
                <td class="product-name">{{ row.name || 'Unnamed product' }}</td>
                <td>{{ row.category || '—' }}</td>
                <td>{{ row.brand || '—' }}</td>
                <td>{{ row.unitOfMeasure || '—' }}</td>
                <td>{{ row.warranty || 'No warranty' }}</td>
                <td>{{ row.condition || '—' }}</td>
                <td>{{ row.shippingWeight ?? '—' }}</td>
                <td>{{ row.isNew ? 'Yes' : 'No' }}</td>
                <td class="variants-cell">
                  <ul>
                    <li v-for="variant in row.variants" :key="variant.name">{{ variant.name }} · {{ variant.sellingPrice === null ? 'No selling price' : `LKR ${variant.sellingPrice}` }} · {{ variant.stock === null ? 'No opening stock' : `Stock ${variant.stock}` }} · Reorder {{ variant.reorderQuantity }} · Location {{ variant.stockLocation || '—' }}{{ variant.quickbooksItemCode ? ` · QB ${variant.quickbooksItemCode}` : '' }}</li>
                  </ul>
                </td>
                <td>
                  <span
                      class="status-badge"
                      :class="row.status === 'Valid' ? 'valid' : 'invalid'"
                  >
                    {{ row.status === 'Valid' ? 'Ready' : 'Needs attention' }}
                  </span>
                </td>
              </tr>
              </tbody>
            </table>
          </div>

        </div>
      </section>


      <!-- 5. Confirm -->
      <section class="card">
        <div class="section-number">5</div>

        <div class="section-body confirm-card">
          <div>
            <h2>Confirm and import</h2>

            <p v-if="hasBlockingErrors">
              Correct all issues and upload the workbook again before importing.
            </p>

            <p v-else>
              Everything looks good. Confirm to add the products, variants, prices, and opening stock.
              Add variant specifications afterward in product administration.
            </p>
          </div>

          <button
              class="primary-button"
              type="button"
              :disabled="busy || preview.counts.valid === 0 || hasBlockingErrors"
              @click="confirmImport"
          >
            {{ busy && stage === 'importing' ? 'Importing…' : `Confirm ${preview.counts.products} products` }}
          </button>
        </div>
      </section>

    </template>


    <!-- Results -->
    <section v-if="result" class="card results">
      <div class="section-body">

        <div class="card-heading">
          <div>
            <h2>Import results</h2>

            <p class="result-summary">
              <span class="status-badge valid">{{ result.imported }} products added</span>
              <span class="status-badge" :class="result.failed ? 'invalid' : 'neutral'">{{ result.failed }} failed</span>
            </p>
          </div>

          <button
              v-if="result.results?.some(row => row.status === 'Failed')"
              class="secondary-button"
              type="button"
              :disabled="busy"
              @click="retryFailed"
          >
            Retry failed products
          </button>
        </div>

        <h3>Added successfully ({{ addedProducts.length }})</h3>

        <ul class="added-list">
          <li v-for="row in addedProducts" :key="row.rowNumber">
            <strong>{{ row.name }}</strong>
            <span>item code {{ row.itemCode }}</span>
          </li>
        </ul>

        <h3 v-if="failedProducts.length">Could not add ({{ failedProducts.length }})</h3>

        <div v-if="failedProducts.length" class="table-wrap">
          <table>
            <thead>
            <tr>
              <th>Product row</th>
              <th>Product</th>
              <th>What happened</th>
            </tr>
            </thead>

            <tbody>
            <tr v-for="row in failedProducts" :key="row.rowNumber">
              <td>{{ row.rowNumber }}</td>
              <td class="product-name">{{ row.name }}</td>
              <td class="problem">{{ row.error || row.errors?.join(' ') || 'Please review this product.' }}</td>
            </tr>
            </tbody>
          </table>
        </div>

      </div>
    </section>

  </main>
</template>

<style scoped>
.page-container {
  width: 100%;
  max-width: 1250px;
  margin-inline: auto;
  font-family: var(--font-family);
}

/* =========================
   Page Header
   ========================= */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  max-width: 70ch;
  margin-top: 5px;
  font-size: var(--font-size-md);
  line-height: 1.55;
  color: var(--color-text-secondary);
}

/* =========================
   Steps
   ========================= */

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin: 0 0 var(--spacing-xl);
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.steps li {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 7px var(--spacing-md) 7px 8px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  counter-increment: step;
}

.steps li::before {
  content: counter(step);
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.steps li.current {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.steps li.current::before {
  background: var(--color-primary);
  color: var(--color-text-light);
}

/* =========================
   Notice
   ========================= */

.notice {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

/* =========================
   Cards
   ========================= */

.card {
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.card h2 {
  margin: 0 0 6px;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.card h3 {
  margin: var(--spacing-xl) 0 var(--spacing-md);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.card p {
  margin: 0 0 var(--spacing-lg);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.section-number {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--font-weight-bold);
}

.section-body {
  flex: 1;
  min-width: 0;
}

.card-heading,
.confirm-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
}

.card-heading p {
  margin-bottom: 0;
}

.confirm-card p {
  margin-bottom: 0;
}

.plain-list {
  margin: 0;
  padding-left: 20px;
  font-size: var(--font-size-sm);
  line-height: 1.75;
  color: var(--color-text-secondary);
}

.plain-list li + li {
  margin-top: 4px;
}

.plain-list strong {
  color: var(--color-text-primary);
}

/* =========================
   Buttons
   ========================= */

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.primary-button:focus-visible,
.secondary-button:focus-visible,
input[type='file']:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* =========================
   Upload
   ========================= */

.upload-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-hover-bg);
}

input[type='file'] {
  flex: 1;
  min-width: 220px;
  max-width: 100%;
  font-family: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

input[type='file']::file-selector-button {
  margin-right: var(--spacing-md);
  padding: 8px var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast);
}

input[type='file']::file-selector-button:hover {
  background: var(--color-surface-hover);
}

progress {
  display: block;
  width: 100%;
  height: 8px;
  margin-top: var(--spacing-lg);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--color-hover-bg);
  overflow: hidden;
  appearance: none;
}

progress::-webkit-progress-bar {
  background: var(--color-hover-bg);
}

progress::-webkit-progress-value {
  background: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-fast);
}

progress::-moz-progress-bar {
  background: var(--color-primary);
}

/* =========================
   Stats
   ========================= */

.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(100px, 1fr));
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
}

.stats div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-hover-bg);
}

.stats b {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  color: var(--color-text-primary);
}

.stats span {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.stats .stat-good {
  background: var(--color-success-bg);
  border-color: transparent;
}

.stats .stat-good b {
  color: var(--color-success);
}

.stats .stat-bad {
  background: var(--color-danger-bg);
  border-color: transparent;
}

.stats .stat-bad b {
  color: var(--color-danger);
}

/* =========================
   Tables
   ========================= */

.table-wrap {
  margin-top: var(--spacing-md);
  overflow: auto;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

td {
  padding: 12px var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: top;
}

tbody tr {
  transition: background var(--transition-fast);
}

tbody tr:hover {
  background: var(--color-surface-hover);
}

tbody tr:last-child td {
  border-bottom: none;
}

.product-name {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.problem {
  color: var(--color-danger);
}

.variants-cell {
  min-width: 280px;
}

.variants-cell ul {
  margin: 0;
  padding-left: 16px;
  line-height: 1.55;
}

.variants-cell li + li {
  margin-top: 4px;
}

/* =========================
   Badges
   ========================= */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge.valid {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.invalid {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.status-badge.neutral {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
}

/* =========================
   Results
   ========================= */

.results {
  overflow: hidden;
}

.result-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: 0;
}

.added-list {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.added-list:empty {
  display: none;
}

.added-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  padding: 11px var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-sm);
}

.added-list li:last-child {
  border-bottom: none;
}

.added-list strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.added-list span {
  color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 800px) {
  .stats {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  .card-heading,
  .confirm-card {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .card {
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
  }

  .upload-row .primary-button,
  .confirm-card .primary-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-button,
  .secondary-button,
  tbody tr,
  progress::-webkit-progress-value {
    transition: none;
  }
}
</style>