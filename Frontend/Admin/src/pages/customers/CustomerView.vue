<script setup>
import { ref, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import api from "../../api/axios"

const route = useRoute()
const router = useRouter()

const customer = ref(null)
const addresses = ref([])
const loading = ref(true)
const errorMessage = ref("")

const loadCustomer = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const customerId = route.params.id

    const response = await api.get(`/customers/${customerId}`)

    customer.value = response.data.data

  } catch (error) {
    console.error("Customer loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load customer."
  } finally {
    loading.value = false
  }
}

const loadAddresses = async () => {
  try {
    const customerId = route.params.id

    const response = await api.get(
        `/customers/${customerId}/addresses`
    )

    addresses.value = response.data.data || []

  } catch (error) {
    console.error("Address loading error:", error)

    addresses.value = []
  }
}

const editCustomer = () => {
  router.push(`/admin/customers/edit/${route.params.id}`)
}

const goBack = () => {
  router.push("/admin/customers/all-customers")
}

const formatAddress = (address) => {
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country
  ]
      .filter(Boolean)
      .join(", ")
}

onMounted(async () => {
  await loadCustomer()
  await loadAddresses()
})
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>
          Customer Details
        </h1>

        <p>
          View customer information and addresses.
        </p>
      </div>

      <div class="header-actions">

        <button
            class="secondary-button"
            @click="goBack"
        >
          Back
        </button>

        <button
            v-if="customer"
            class="primary-button"
            @click="editCustomer"
        >
          Edit Customer
        </button>

      </div>

    </div>


    <!-- Loading -->
    <div
        v-if="loading"
        class="empty-state"
    >
      Loading customer...
    </div>


    <!-- Error -->
    <div
        v-else-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>


    <!-- Customer -->
    <div
        v-else-if="customer"
        class="content-wrapper"
    >

      <!-- Customer Information -->
      <div class="card">

        <div class="card-header">
          <h2>Customer Information</h2>
        </div>

        <div class="details-grid">

          <div class="detail-item">
                        <span class="detail-label">
                            Customer Code
                        </span>

            <span class="detail-value">
                            {{ customer.customer_code || "-" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            Status
                        </span>

            <span
                class="status-badge"
                :class="customer.is_active
                                ? 'active'
                                : 'inactive'"
            >
                            {{ customer.is_active
                ? "Active"
                : "Inactive" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            First Name
                        </span>

            <span class="detail-value">
                            {{ customer.first_name || "-" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            Last Name
                        </span>

            <span class="detail-value">
                            {{ customer.last_name || "-" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            Email
                        </span>

            <span class="detail-value">
                            {{ customer.email || "-" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            Phone
                        </span>

            <span class="detail-value">
                            {{ customer.phone || "-" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            Created At
                        </span>

            <span class="detail-value">
                            {{ customer.created_at || "-" }}
                        </span>
          </div>


          <div class="detail-item">
                        <span class="detail-label">
                            Updated At
                        </span>

            <span class="detail-value">
                            {{ customer.updated_at || "-" }}
                        </span>
          </div>

        </div>

      </div>


      <!-- Addresses -->
      <div class="card">

        <div class="card-header">

          <div>
            <h2>Customer Addresses</h2>

            <p>
              Shipping and billing addresses
            </p>
          </div>

          <router-link
              :to="`/admin/customers/${customer.id}/addresses/create`"
              class="primary-button"
          >
            + Add Address
          </router-link>

        </div>


        <!-- No addresses -->
        <div
            v-if="!addresses.length"
            class="empty-state"
        >
          No addresses found for this customer.
        </div>


        <!-- Address list -->
        <div
            v-else
            class="address-list"
        >

          <div
              v-for="address in addresses"
              :key="address.id"
              class="address-card"
          >

            <div class="address-header">

              <div>

                <h3>
                  {{ address.recipient_name }}
                </h3>

                <span
                    class="type-badge"
                    :class="address.address_type?.toLowerCase()"
                >
                                    {{ address.address_type }}
                                </span>

              </div>


              <div class="default-badges">

                                <span
                                    v-if="address.is_default"
                                    class="default-badge"
                                >
                                    Default
                                </span>

              </div>

            </div>


            <div class="address-body">

              <p>
                {{ formatAddress(address) }}
              </p>

              <p>
                <strong>Phone:</strong>
                {{ address.phone || "-" }}
              </p>

            </div>


            <div class="address-actions">

              <router-link
                  :to="`/admin/customers/${customer.id}/addresses/${address.id}/edit`"
                  class="action-button edit"
              >
                Edit
              </router-link>

            </div>

          </div>

        </div>

      </div>

    </div>

  </div>
</template>


<style scoped>

.page-container {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
}

.page-header p {
  margin: 0;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.primary-button,
.secondary-button,
.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 14px;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  font-size: 14px;
  border: none;
}

.primary-button {
  background: #111827;
  color: white;
}

.secondary-button {
  background: #e5e7eb;
  color: #111827;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.card-header {
  padding: 18px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  font-size: 19px;
}

.card-header p {
  margin: 5px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.detail-item {
  padding: 18px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.detail-value {
  font-size: 15px;
  color: #111827;
}

.status-badge,
.type-badge,
.default-badge {
  display: inline-block;
  padding: 4px 9px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.type-badge {
  background: #e5e7eb;
  color: #374151;
}

.type-badge.shipping {
  background: #dbeafe;
  color: #1d4ed8;
}

.type-badge.billing {
  background: #fef3c7;
  color: #92400e;
}

.default-badge {
  background: #dcfce7;
  color: #166534;
}

.address-list {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.address-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.address-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.address-header h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.address-body {
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
}

.address-body p {
  margin: 0 0 8px;
}

.address-actions {
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.action-button.edit {
  background: #f3f4f6;
  color: #111827;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: #6b7280;
}

.error-state {
  padding: 15px;
  border-radius: 6px;
  background: #fee2e2;
  color: #991b1b;
}

@media (max-width: 768px) {

  .page-header {
    flex-direction: column;
    gap: 15px;
  }

  .details-grid,
  .address-list {
    grid-template-columns: 1fr;
  }

}

</style>
