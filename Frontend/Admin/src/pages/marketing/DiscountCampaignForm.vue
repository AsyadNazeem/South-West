
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
    getDiscountCampaign,
    createDiscountCampaign,
    updateDiscountCampaign,
} from '../../api/discountCampaignApi'

import { getCampaignFrames } from '../../api/campaignFrameApi'

import api from '../../api/axios'
import itemApi from '../../api/itemApi'

const route = useRoute()
const router = useRouter()

import { getMediaUrl } from '../../utils/mediaUrl'

function getFrameImageUrl(frame) {
    const value = frame?.image_url || frame?.image_path || ''

    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value

    return getMediaUrl(value)
}

const campaignId = computed(() => route.params.id)
const isEdit = computed(() => Boolean(campaignId.value))

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const fieldErrors = reactive({})



const statuses = [
    'draft',
    'scheduled',
    'active',
    'paused',
    'expired',
    'cancelled',
]

const reasons = [
    { value: 'seasonal', label: 'Seasonal sale' },
    { value: 'clearance', label: 'Clearance' },
    { value: 'promotion', label: 'Promotion' },
    { value: 'launch', label: 'Product launch' },
    { value: 'custom', label: 'Other / custom reason' },
]

const form = reactive({
    campaign_name: '',
    description: '',
    discount_reason: 'promotion',
    custom_reason: '',
    discount_type: 'percentage',
    discount_value: '',
    allow_promo_code: false,
    target_type: 'all_products',
    item_ids: [],
    category_ids: [],
    brand_ids: [],
    start_date: '',
    end_date: '',
    status: 'draft',
    visual_frame_id: null,
    visual_frame_enabled: false,
    visual_priority: 0,
})

const items = ref([])
const categories = ref([])
const brands = ref([])
const frames = ref([])
const targetSearch = ref('')

const selectedFrame = computed(() =>
    frames.value.find(frame =>
        Number(frame.id) === Number(form.visual_frame_id)
    ) || null
)

const discountSuffix = computed(() =>
    form.discount_type === 'percentage' ? '%' : 'Rs.',
)

const targetNoun = computed(() => ({
    selected_products: 'products',
    category: 'categories',
    brand: 'brands',
}[form.target_type] || ''))

const selectedKey = computed(() => ({
    selected_products: 'item_ids',
    category: 'category_ids',
    brand: 'brand_ids',
}[form.target_type] || null))

const selectedCount = computed(() => {
    return selectedKey.value ? form[selectedKey.value].length : 0
})

function getId(value) {
    const id = Number(value)
    return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * Supports common API response formats:
 * { data: [...] }
 * { data: { data: [...] } }
 * [...]
 */
function toArray(response) {
    const body = response?.data ?? response
    const result = body?.data ?? body

    if (Array.isArray(result)) return result
    if (Array.isArray(result?.rows)) return result.rows
    if (Array.isArray(result?.items)) return result.items

    return []
}

function getOptionLabel(option, type) {
    if (type === 'selected_products') {
        return (
            option.item_name ||
            option.product_name ||
            option.name ||
            `Product #${option.id}`
        )
    }

    if (type === 'category') {
        return (
            option.category_name ||
            option.name ||
            `Category #${option.id}`
        )
    }

    return option.brand_name || option.name || `Brand #${option.id}`
}

const targetOptions = computed(() => {
    let source = []

    if (form.target_type === 'selected_products') {
        source = items.value
    } else if (form.target_type === 'category') {
        source = categories.value
    } else if (form.target_type === 'brand') {
        source = brands.value
    }

    const options = source
        .map(option => ({
            id: getId(option.id ?? option.item_id ?? option.category_id ?? option.brand_id),
            label: getOptionLabel(option, form.target_type),
        }))
        .filter(option => option.id !== null)

    const query = targetSearch.value.trim().toLowerCase()

    if (!query) return options

    return options.filter(option =>
        option.label.toLowerCase().includes(query),
    )
})

function toggleTarget(id) {
    if (!selectedKey.value) return

    const list = form[selectedKey.value]
    const index = list.indexOf(id)

    if (index === -1) {
        list.push(id)
    } else {
        list.splice(index, 1)
    }
}

function selectAllVisible() {
    if (!selectedKey.value) return

    const list = form[selectedKey.value]

    targetOptions.value.forEach(option => {
        if (!list.includes(option.id)) {
            list.push(option.id)
        }
    })
}

function clearSelection() {
    if (selectedKey.value) {
        form[selectedKey.value] = []
    }
}

function clearInactiveTargets() {
    if (form.target_type !== 'selected_products') {
        form.item_ids = []
    }

    if (form.target_type !== 'category') {
        form.category_ids = []
    }

    if (form.target_type !== 'brand') {
        form.brand_ids = []
    }

    targetSearch.value = ''
    delete fieldErrors.targets
}

function clearFieldError(field) {
    delete fieldErrors[field]
    error.value = ''
}

function toDateInput(value) {
    if (!value) return ''

    // Handles ISO date strings and SQL date/datetime strings.
    return String(value).slice(0, 10)
}


async function loadLookups() {
    const [
        itemsResponse,
        categoriesResponse,
        brandsResponse,
        framesResponse,
    ] = await Promise.all([
        itemApi.getItems(),
        api.get('/categories'),
        api.get('/brands'),
        getCampaignFrames(),
    ])

    items.value = toArray(itemsResponse)
    categories.value = toArray(categoriesResponse)
    brands.value = toArray(brandsResponse)
    frames.value = toArray(framesResponse).filter(frame => frame.is_active)
}

function getAssociationIds(campaign, associationKey, foreignKey) {
    const associations = campaign[associationKey] || []

    return associations
        .map(entry => {
            const id =
                entry[foreignKey] ??
                entry.id ??
                entry.item?.id ??
                entry.category?.id ??
                entry.brand?.id

            return getId(id)
        })
        .filter(id => id !== null)
}

async function loadCampaign() {
    const response = await getDiscountCampaign(campaignId.value)

    const campaign = response?.data?.data

    if (!campaign) {
        throw new Error('Campaign not found.')
    }

    form.campaign_name = campaign.campaign_name || ''
    form.description = campaign.description || ''
    form.discount_reason = campaign.discount_reason || 'promotion'
    form.custom_reason = campaign.custom_reason || ''
    form.discount_type = campaign.discount_type || 'percentage'
    form.discount_value = campaign.discount_value ?? ''
    form.allow_promo_code = Boolean(campaign.allow_promo_code)
    form.target_type = campaign.target_type || 'all_products'
    form.start_date = toDateInput(campaign.start_date)
    form.end_date = toDateInput(campaign.end_date)
    form.status = campaign.status || 'draft'

    form.visual_frame_id =
        campaign.visual_frame_id ??
        campaign.visualFrame?.id ??
        null
    form.visual_frame_enabled = Boolean(campaign.visual_frame_enabled)
    form.visual_priority = Number(campaign.visual_priority || 0)


    form.item_ids = getAssociationIds(
        campaign,
        'campaignItems',
        'item_id',
    )

    form.category_ids = getAssociationIds(
        campaign,
        'campaignCategories',
        'category_id',
    )

    form.brand_ids = getAssociationIds(
        campaign,
        'campaignBrands',
        'brand_id',
    )
}

onMounted(async () => {
    loading.value = true
    error.value = ''

    try {
        await Promise.all([
            loadLookups(),
            isEdit.value ? loadCampaign() : Promise.resolve(),
        ])
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            err.message ||
            'Unable to load campaign form data.'
    } finally {
        loading.value = false
    }
})

function validate() {
    Object.keys(fieldErrors).forEach(key => {
        delete fieldErrors[key]
    })

    const name = form.campaign_name.trim()

    if (!name) {
        fieldErrors.campaign_name = 'Campaign name is required.'
    } else if (name.length > 150) {
        fieldErrors.campaign_name =
            'Campaign name cannot exceed 150 characters.'
    }

    const value = Number(form.discount_value)

    if (
        form.discount_value === '' ||
        !Number.isFinite(value) ||
        value <= 0
    ) {
        fieldErrors.discount_value =
            'Enter a discount value greater than zero.'
    } else if (
        form.discount_type === 'percentage' &&
        value > 100
    ) {
        fieldErrors.discount_value =
            'Percentage discount cannot exceed 100%.'
    }

    if (!['percentage', 'fixed_amount'].includes(form.discount_type)) {
        fieldErrors.discount_type = 'Select a valid discount type.'
    }

    if (!form.discount_reason) {
        fieldErrors.discount_reason = 'Select a discount reason.'
    }

    if (
        form.discount_reason === 'custom' &&
        !form.custom_reason.trim()
    ) {
        fieldErrors.custom_reason =
            'Enter a reason for this custom campaign.'
    }

    if (!form.start_date) {
        fieldErrors.start_date = 'Start date is required.'
    }

    if (!form.end_date) {
        fieldErrors.end_date = 'End date is required.'
    }

    if (
        form.start_date &&
        form.end_date &&
        form.end_date <= form.start_date
    ) {
        fieldErrors.end_date =
            'End date must be later than the start date.'
    }

    if (
        !['all_products', 'selected_products', 'category', 'brand']
            .includes(form.target_type)
    ) {
        fieldErrors.target_type = 'Select a valid campaign target.'
    }

    if (
        form.target_type !== 'all_products' &&
        selectedCount.value === 0
    ) {
        fieldErrors.targets =
            `Select at least one ${targetNoun.value.replace(/s$/, '')}.`
    }

    if (!statuses.includes(form.status)) {
        fieldErrors.status = 'Select a valid campaign status.'
    }

    if (
        form.visual_frame_enabled &&
        !frames.value.some(frame =>
            Number(frame.id) === Number(form.visual_frame_id)
        )
    ) {
        fieldErrors.visual_frame_id =
            'Select an active campaign frame from the library.'
    }

    if (
        form.visual_frame_enabled &&
        (
            !Number.isInteger(Number(form.visual_priority)) ||
            Number(form.visual_priority) < 0 ||
            Number(form.visual_priority) > 1000000
        )
    ) {
        fieldErrors.visual_priority =
            'Visual priority must be a whole number between 0 and 1000000.'
    }

    return Object.keys(fieldErrors).length === 0
}

function buildPayload() {
    return {
        campaign_name: form.campaign_name.trim(),
        description: form.description.trim() || null,

        discount_reason: form.discount_reason,
        custom_reason:
            form.discount_reason === 'custom'
                ? form.custom_reason.trim()
                : null,

        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        allow_promo_code: Boolean(form.allow_promo_code),

        visual_frame_id: form.visual_frame_enabled
            ? Number(form.visual_frame_id)
            : null,
        visual_frame_enabled: Boolean(form.visual_frame_enabled),
        visual_priority: Number(form.visual_priority || 0),

        target_type: form.target_type,

        item_ids:
            form.target_type === 'selected_products'
                ? [...form.item_ids]
                : [],

        category_ids:
            form.target_type === 'category'
                ? [...form.category_ids]
                : [],

        brand_ids:
            form.target_type === 'brand'
                ? [...form.brand_ids]
                : [],

        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
    }
}

async function submit() {
    error.value = ''

    if (!validate()) return

    saving.value = true

    try {
        const payload = buildPayload()

        if (isEdit.value) {
            await updateDiscountCampaign(campaignId.value, payload)
        } else {
            await createDiscountCampaign(payload)
        }

        router.push('/admin/marketing/discount-campaigns')
    } catch (err) {
        const serverErrors = err.response?.data?.errors

        if (serverErrors && typeof serverErrors === 'object') {
            Object.entries(serverErrors).forEach(([key, message]) => {
                fieldErrors[key] = Array.isArray(message)
                    ? message[0]
                    : message
            })
        }

        error.value =
            err.response?.data?.message ||
            err.message ||
            'Unable to save the campaign.'
    } finally {
        saving.value = false
    }
}
function goBack() {
    router.push('/admin/marketing/discount-campaigns')
}
</script>

<template>
    <main class="form-page">
        <header class="page-header">
            <div>
                <p class="eyebrow">MARKETING</p>

                <h1>
                    {{ isEdit ? 'Edit discount campaign' : 'Create discount campaign' }}
                </h1>

                <p class="subtitle">
                    {{
                        isEdit
                            ? 'Update the discount, target audience and schedule.'
                            : 'Create a discount and choose which products it applies to.'
                    }}
                </p>
            </div>

            <button
                class="secondary-button"
                type="button"
                @click="goBack"
            >
                ← Back to campaigns
            </button>
        </header>

        <div v-if="loading" class="panel state-message">
            Loading campaign data...
        </div>

        <div v-else-if="error && !isEdit" class="error-message">
            {{ error }}
        </div>

        <form
            v-else
            class="form-layout"
            novalidate
            @submit.prevent="submit"
        >
            <div v-if="error" class="error-message">
                {{ error }}
            </div>

            <!-- Campaign details -->
            <section class="panel">
                <div class="panel-heading">
                    <h2>Campaign details</h2>
                    <p>Give the campaign a name and description.</p>
                </div>

                <div class="panel-body grid">
                    <div class="field full">
                        <label for="campaign_name">Campaign name</label>

                        <input
                            id="campaign_name"
                            v-model="form.campaign_name"
                            type="text"
                            maxlength="150"
                            placeholder="e.g. Avurudu Sale 2026"
                            :class="{ invalid: fieldErrors.campaign_name }"
                            @input="clearFieldError('campaign_name')"
                        />

                        <span
                            v-if="fieldErrors.campaign_name"
                            class="field-error"
                        >
                            {{ fieldErrors.campaign_name }}
                        </span>
                    </div>

                    <div class="field full">
                        <label for="description">
                            Description
                            <span class="optional">(optional)</span>
                        </label>

                        <textarea
                            id="description"
                            v-model="form.description"
                            rows="3"
                            placeholder="Describe the campaign..."
                        />
                    </div>
                </div>
            </section>

            <!-- Discount settings -->
            <section class="panel">
                <div class="panel-heading">
                    <h2>Discount settings</h2>
                    <p>Choose the discount type, value and reason.</p>
                </div>

                <div class="panel-body grid">
                    <div class="field">
                        <label>Discount type</label>

                        <div
                            class="segmented"
                            role="group"
                            aria-label="Discount type"
                        >
                            <button
                                type="button"
                                :class="{
                                    active: form.discount_type === 'percentage',
                                }"
                                :aria-pressed="form.discount_type === 'percentage'"
                                @click="
                                    form.discount_type = 'percentage';
                                    clearFieldError('discount_type');
                                    clearFieldError('discount_value')
                                "
                            >
                                Percentage
                            </button>

                            <button
                                type="button"
                                :class="{
                                    active: form.discount_type === 'fixed_amount',
                                }"
                                :aria-pressed="form.discount_type === 'fixed_amount'"
                                @click="
                                    form.discount_type = 'fixed_amount';
                                    clearFieldError('discount_type');
                                    clearFieldError('discount_value')
                                "
                            >
                                Fixed amount
                            </button>
                        </div>

                        <span
                            v-if="fieldErrors.discount_type"
                            class="field-error"
                        >
                            {{ fieldErrors.discount_type }}
                        </span>
                    </div>

                    <div class="field">
                        <label for="discount_value">Discount value</label>

                        <div
                            class="input-affix"
                            :class="{ invalid: fieldErrors.discount_value }"
                        >
                            <span>{{ discountSuffix }}</span>

                            <input
                                id="discount_value"
                                v-model="form.discount_value"
                                type="number"
                                min="0.01"
                                :max="
                                    form.discount_type === 'percentage'
                                        ? 100
                                        : undefined
                                "
                                step="0.01"
                                placeholder="0"
                                @input="clearFieldError('discount_value')"
                            />
                        </div>

                        <span
                            v-if="fieldErrors.discount_value"
                            class="field-error"
                        >
                            {{ fieldErrors.discount_value }}
                        </span>

                        <p class="hint">
                            {{
                                form.discount_type === 'percentage'
                                    ? 'Enter a percentage from greater than 0 up to 100.'
                                    : 'Enter the amount to deduct from the product price.'
                            }}
                        </p>
                    </div>

                    <div class="field">
                        <label for="discount_reason">Discount reason</label>

                        <select
                            id="discount_reason"
                            v-model="form.discount_reason"
                            :class="{ invalid: fieldErrors.discount_reason }"
                            @change="clearFieldError('discount_reason')"
                        >
                            <option
                                v-for="reason in reasons"
                                :key="reason.value"
                                :value="reason.value"
                            >
                                {{ reason.label }}
                            </option>
                        </select>

                        <span
                            v-if="fieldErrors.discount_reason"
                            class="field-error"
                        >
                            {{ fieldErrors.discount_reason }}
                        </span>
                    </div>

                    <div
                        v-if="form.discount_reason === 'custom'"
                        class="field"
                    >
                        <label for="custom_reason">Custom reason</label>

                        <input
                            id="custom_reason"
                            v-model="form.custom_reason"
                            type="text"
                            placeholder="Enter the reason"
                            :class="{ invalid: fieldErrors.custom_reason }"
                            @input="clearFieldError('custom_reason')"
                        />

                        <span
                            v-if="fieldErrors.custom_reason"
                            class="field-error"
                        >
                            {{ fieldErrors.custom_reason }}
                        </span>
                    </div>

                    <div class="field full promo-option">
                        <label class="check">
                            <input
                                v-model="form.allow_promo_code"
                                type="checkbox"
                            />

                            <span>
                                <strong>Allow promo codes</strong>
                                <small>
                                    Enable promo-code eligibility for this campaign.
                                </small>
                            </span>
                        </label>
                    </div>
                </div>
            </section>

            <!-- Targeting -->
            <section class="panel">
                <div class="panel-heading">
                    <h2>Applies to</h2>
                    <p>Choose which products receive this discount.</p>
                </div>

                <div class="panel-body">
                    <div class="field">
                        <label for="target_type">Campaign target</label>

                        <select
                            id="target_type"
                            v-model="form.target_type"
                            :class="{ invalid: fieldErrors.target_type }"
                            @change="
                                clearInactiveTargets();
                                clearFieldError('target_type')
                            "
                        >
                            <option value="all_products">All products</option>
                            <option value="selected_products">Selected products</option>
                            <option value="category">Categories</option>
                            <option value="brand">Brands</option>
                        </select>

                        <span
                            v-if="fieldErrors.target_type"
                            class="field-error"
                        >
                            {{ fieldErrors.target_type }}
                        </span>
                    </div>

                    <div
                        v-if="form.target_type !== 'all_products'"
                        class="picker"
                    >
                        <div class="picker-toolbar">
                            <input
                                v-model="targetSearch"
                                type="search"
                                :placeholder="`Search ${targetNoun}...`"
                                :aria-label="`Search ${targetNoun}`"
                            />

                            <button
                                type="button"
                                class="text-button"
                                @click="selectAllVisible"
                            >
                                Select shown
                            </button>

                            <button
                                type="button"
                                class="text-button muted-button"
                                @click="clearSelection"
                            >
                                Clear
                            </button>
                        </div>

                        <div
                            v-if="fieldErrors.targets"
                            class="field-error target-error"
                        >
                            {{ fieldErrors.targets }}
                        </div>

                        <ul
                            class="picker-list"
                            :class="{ invalid: fieldErrors.targets }"
                        >
                            <li
                                v-if="!targetOptions.length"
                                class="picker-empty"
                            >
                                No {{ targetNoun }} found.
                            </li>

                            <li
                                v-for="option in targetOptions"
                                :key="option.id"
                            >
                                <label class="check picker-check">
                                    <input
                                        type="checkbox"
                                        :checked="
                                            selectedKey &&
                                            form[selectedKey].includes(option.id)
                                        "
                                        @change="toggleTarget(option.id)"
                                    />

                                    <span>{{ option.label }}</span>
                                </label>
                            </li>
                        </ul>

                        <div class="picker-footer">
                            <span class="muted">
                                {{ selectedCount }} {{ targetNoun }} selected
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Campaign frame library selection -->
            <section class="panel">
                <div class="panel-heading">
                    <h2>Campaign product frame</h2>
                    <p>
                        Select a frame from the uploaded Campaign Frames library.
                        The selected frame appears around eligible product images
                        in the customer storefront.
                    </p>
                </div>

                <div class="panel-body">
                    <div class="visual-enable">
                        <label class="check">
                            <input
                                v-model="form.visual_frame_enabled"
                                type="checkbox"
                                @change="clearFieldError('visual_frame_id')"
                            />
                            <span>
                                <strong>Enable campaign frame</strong>
                                <small>
                                    Display the selected frame on products included
                                    in this campaign.
                                </small>
                            </span>
                        </label>
                    </div>

                    <div
                        v-if="form.visual_frame_enabled"
                        class="visual-settings grid"
                    >
                        <div class="field">
                            <label for="visual_frame_id">Campaign frame</label>
                            <select
                                id="visual_frame_id"
                                v-model="form.visual_frame_id"
                                :class="{ invalid: fieldErrors.visual_frame_id }"
                                @change="clearFieldError('visual_frame_id')"
                            >
                                <option :value="null" disabled>
                                    Select an uploaded frame
                                </option>
                                <option
                                    v-for="frame in frames"
                                    :key="frame.id"
                                    :value="frame.id"
                                >
                                    {{ frame.name }}
                                </option>
                            </select>

                            <span
                                v-if="fieldErrors.visual_frame_id"
                                class="field-error"
                            >
                                {{ fieldErrors.visual_frame_id }}
                            </span>

                            <p v-if="frames.length === 0" class="hint">
                                No active frames are available. Add and activate
                                a frame from Marketing → Campaign Frames.
                            </p>
                        </div>

                        <div class="field">
                            <label for="visual_priority">Visual priority</label>
                            <input
                                id="visual_priority"
                                v-model.number="form.visual_priority"
                                type="number"
                                min="0"
                                max="1000000"
                                step="1"
                            />
                            <p class="hint">
                                Higher priority wins when a product belongs to
                                multiple campaigns with visual frames.
                            </p>
                        </div>

                        <div
                            v-if="selectedFrame"
                            class="field full"
                        >
                            <label>Selected frame preview</label>
                            <div class="frame-preview">
                                <img
                                    :src="getFrameImageUrl(selectedFrame)"
                                    :alt="selectedFrame.name"
                                />
                            </div>
                            <p class="hint">
                                {{ selectedFrame.name }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Schedule and status -->
            <section class="panel">
                <div class="panel-heading">
                    <h2>Schedule and status</h2>
                    <p>Choose the campaign dates and current status.</p>
                </div>

                <div class="panel-body grid three">
                    <div class="field">
                        <label for="start_date">Start date</label>

                        <input
                            id="start_date"
                            v-model="form.start_date"
                            type="date"
                            :class="{ invalid: fieldErrors.start_date }"
                            @change="clearFieldError('start_date')"
                        />

                        <span
                            v-if="fieldErrors.start_date"
                            class="field-error"
                        >
                            {{ fieldErrors.start_date }}
                        </span>
                    </div>

                    <div class="field">
                        <label for="end_date">End date</label>

                        <input
                            id="end_date"
                            v-model="form.end_date"
                            type="date"
                            :min="form.start_date || undefined"
                            :class="{ invalid: fieldErrors.end_date }"
                            @change="clearFieldError('end_date')"
                        />

                        <span
                            v-if="fieldErrors.end_date"
                            class="field-error"
                        >
                            {{ fieldErrors.end_date }}
                        </span>
                    </div>

                    <div class="field">
                        <label for="status">Status</label>

                        <select
                            id="status"
                            v-model="form.status"
                            :class="{ invalid: fieldErrors.status }"
                            @change="clearFieldError('status')"
                        >
                            <option
                                v-for="status in statuses"
                                :key="status"
                                :value="status"
                            >
                                {{ status.charAt(0).toUpperCase() + status.slice(1) }}
                            </option>
                        </select>

                        <span
                            v-if="fieldErrors.status"
                            class="field-error"
                        >
                            {{ fieldErrors.status }}
                        </span>
                    </div>
                </div>
            </section>

            <!-- Actions -->
            <footer class="form-actions">
                <button
                    type="button"
                    class="secondary-button"
                    :disabled="saving"
                    @click="goBack"
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    class="primary-button"
                    :disabled="saving"
                >
                    {{
                        saving
                            ? 'Saving...'
                            : isEdit
                                ? 'Save changes'
                                : 'Create campaign'
                    }}
                </button>
            </footer>
        </form>
    </main>
</template>

<style scoped>
.form-page {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    font-family: var(--font-family);
    color: var(--color-text-primary);
}

/* =========================
   Page header
   ========================= */

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-2xl);
}

.eyebrow {
    margin: 0 0 6px;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 1.4px;
}

.page-header h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

.subtitle {
    margin: 5px 0 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
}

/* =========================
   Layout + panels (sections)
   ========================= */

.form-layout {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
}

.panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

.panel-heading {
    padding: var(--spacing-2xl) var(--spacing-2xl) 0;
    margin-bottom: var(--spacing-xl);
}

.panel-heading h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

.panel-heading p {
    margin: 5px 0 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
}

.panel-body {
    padding: 0 var(--spacing-2xl) var(--spacing-2xl);
}

.grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-xl);
}

.grid.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.full {
    grid-column: 1 / -1;
}

/* =========================
   Fields
   ========================= */

.field {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.field > label {
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.optional {
    font-weight: 400;
    color: var(--color-text-muted);
}

input[type='text'],
input[type='number'],
input[type='date'],
input[type='search'],
select,
textarea {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-size-md);
    outline: none;
    transition: border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

input[type='text'],
input[type='number'],
input[type='date'],
input[type='search'],
select {
    height: 40px;
    padding: 0 var(--spacing-lg);
}

textarea {
    padding: 10px var(--spacing-lg);
    resize: vertical;
}

input::placeholder,
textarea::placeholder {
    color: var(--color-text-muted);
}

input:focus,
select:focus,
textarea:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Validation */

.invalid,
input.invalid,
select.invalid,
textarea.invalid {
    border-color: var(--color-danger) !important;
}

.field-error {
    margin-top: 6px;
    font-size: var(--font-size-xs);
    color: var(--color-danger);
}

.hint {
    margin: 6px 0 0;
    font-size: var(--font-size-xs);
    line-height: 1.5;
    color: var(--color-text-muted);
}

/* =========================
   Input with prefix (Rs. / %)
   ========================= */

.input-affix {
    display: flex;
    align-items: stretch;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    transition: border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-affix:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.input-affix.invalid {
    border-color: var(--color-danger) !important;
}

.input-affix > span {
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-lg);
    border-right: 1px solid var(--color-border-light);
    background: var(--color-submenu-bg);
    color: var(--color-text-secondary);
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
}

.input-affix input {
    height: 38px;
    border: 0;
    border-radius: 0;
    box-shadow: none !important;
}

/* =========================
   Segmented control
   ========================= */

.segmented {
    display: inline-flex;
    align-self: flex-start;
    overflow: hidden;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}

.segmented button {
    height: 38px;
    padding: 0 var(--spacing-xl);
    border: 0;
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: background var(--transition-fast),
    color var(--transition-fast);
}

.segmented button + button {
    border-left: 1px solid var(--color-border);
}

.segmented button:hover:not(.active) {
    background: var(--color-hover-bg);
    color: var(--color-text-primary);
}

.segmented button.active {
    background: var(--color-primary);
    color: var(--color-text-light);
}

/* =========================
   Checkboxes
   ========================= */

.check {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-md);
    font-weight: 500;
    cursor: pointer;
}

.check input {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    padding: 0;
    accent-color: var(--color-primary);
}

.promo-option {
    padding: var(--spacing-lg);
    background: var(--color-submenu-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
}

.promo-option .check {
    align-items: flex-start;
}

.promo-option strong,
.promo-option small {
    display: block;
}

.promo-option strong {
    font-size: var(--font-size-md);
    color: var(--color-text-primary);
}

.promo-option small {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    font-weight: 400;
    color: var(--color-text-muted);
}

/* =========================
   Target picker
   ========================= */

.picker {
    margin-top: var(--spacing-xl);
    padding: var(--spacing-lg);
    background: var(--color-submenu-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
}

.picker-toolbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
}

.picker-toolbar input {
    flex: 1;
}

.picker-list {
    overflow-y: auto;
    max-height: 260px;
    margin: 0;
    padding: 6px;
    list-style: none;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
}

.picker-list.invalid {
    border-color: var(--color-danger);
}

.picker-list > li {
    list-style: none;
}

.picker-check {
    padding: 8px 10px;
    border-radius: var(--radius-lg);
    transition: background var(--transition-fast);
}

.picker-check:hover {
    background: var(--color-hover-bg);
}

.picker-empty {
    padding: var(--spacing-xl);
    text-align: center;
    font-size: var(--font-size-md);
    color: var(--color-text-muted);
}

.picker-footer {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
    margin-top: var(--spacing-sm);
}

.target-error {
    display: block;
    margin: 0 0 var(--spacing-sm);
}

.muted {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

/* =========================
   Buttons
   ========================= */

.primary-button,
.secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0 var(--spacing-xl);
    border-radius: var(--radius-lg);
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.primary-button {
    border: none;
    background: var(--color-primary);
    color: var(--color-text-light);
}

.primary-button:hover:not(:disabled) {
    background: var(--color-primary-hover);
}

.secondary-button {
    border: 1px solid var(--color-border-light);
    background: var(--color-surface);
    color: var(--color-text-secondary);
}

.secondary-button:hover:not(:disabled) {
    background: var(--color-hover-bg);
    color: var(--color-text-primary);
}

.text-button {
    padding: 0 var(--spacing-sm);
    border: 0;
    background: transparent;
    color: var(--color-primary);
    font-family: inherit;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    cursor: pointer;
}

.text-button:hover {
    text-decoration: underline;
}

.muted-button {
    color: var(--color-text-muted);
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
}

/* =========================
   Messages
   ========================= */

.error-message {
    padding: var(--spacing-md) var(--spacing-lg);
    border: 1px solid var(--color-danger-light);
    border-radius: var(--radius-lg);
    background: var(--color-danger-bg);
    color: var(--color-danger);
    font-size: var(--font-size-md);
}

.state-message {
    padding: 48px var(--spacing-2xl);
    text-align: center;
    color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .grid,
    .grid.three {
        grid-template-columns: minmax(0, 1fr);
    }

    .panel-heading {
        padding: var(--spacing-xl) var(--spacing-xl) 0;
    }

    .panel-body {
        padding: 0 var(--spacing-xl) var(--spacing-xl);
    }

    .picker-toolbar {
        flex-wrap: wrap;
    }

    .picker-toolbar input {
        flex-basis: 100%;
    }

    .form-actions {
        flex-direction: column-reverse;
    }

    .primary-button,
    .secondary-button {
        width: 100%;
    }
}

/* Campaign visual theme */

.visual-enable {
    padding: var(--spacing-lg);
    background: var(--color-submenu-bg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
}

.visual-enable .check {
    align-items: flex-start;
}

.visual-enable strong,
.visual-enable small {
    display: block;
}

.visual-enable small {
    margin-top: 4px;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: 400;
    line-height: 1.5;
}

.visual-settings {
    margin-top: var(--spacing-xl);
}

.frame-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    margin-top: var(--spacing-md);
    padding: var(--spacing-lg);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-lg);
    background-color: var(--color-submenu-bg);
    background-image:
        linear-gradient(45deg, var(--color-border-light) 25%, transparent 25%),
        linear-gradient(-45deg, var(--color-border-light) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--color-border-light) 75%),
        linear-gradient(-45deg, transparent 75%, var(--color-border-light) 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

.frame-preview img {
    display: block;
    max-width: 100%;
    max-height: 240px;
    object-fit: contain;
}



/* Custom campaign frame upload instructions */
.custom-frame-notice {
    margin-top: 12px;
    padding: 16px;
    border: 1px solid #bfdbfe;
    border-radius: 10px;
    background: #eff6ff;
    color: #1e3a8a;
    font-size: 13px;
    line-height: 1.6;
}

.custom-frame-notice__heading {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 700;
}

.custom-frame-notice ul {
    margin: 0;
    padding-left: 20px;
}

.custom-frame-notice li {
    margin: 4px 0;
}

.custom-frame-notice__tip {
    margin: 12px 0 0;
    padding-top: 10px;
    border-top: 1px solid #bfdbfe;
    font-weight: 500;
}
</style>
