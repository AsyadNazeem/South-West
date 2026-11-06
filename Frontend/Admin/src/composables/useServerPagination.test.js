import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequestSequence, useServerPagination } from './useServerPagination.js'

test('normalizes pagination inputs and uses server total page metadata', async () => {
  const pagination = useServerPagination('25')

  const received = pagination.receive({ page: 8, pageSize: 25, total: 101, totalPages: 3 })

  assert.deepEqual(received, { page: 3, pageSize: 25, total: 101, totalPages: 3 })
  assert.deepEqual(pagination.params(), { page: 3, pageSize: 25 })
  assert.equal(await pagination.goToPage(4), false)
  assert.equal(await pagination.goToPage(0), false)
})

test('empty results keep a safe first page and zero total', () => {
  const pagination = useServerPagination(25)

  assert.deepEqual(pagination.receive({ page: 1, pageSize: 25, total: 0, totalPages: 0 }), {
    page: 1, pageSize: 25, total: 0, totalPages: 1
  })
})

test('null and undefined totalPages fall back to the calculated page count', () => {
  for (const totalPages of [null, undefined]) {
    const pagination = useServerPagination(25)
    const received = pagination.receive({ total: 101, pageSize: 25, totalPages })

    assert.equal(received.totalPages, 5)
  }
})

test('an explicit zero totalPages for an empty result remains one display page', () => {
  const pagination = useServerPagination(25)

  const received = pagination.receive({ total: 0, pageSize: 25, totalPages: 0 })

  assert.equal(received.totalPages, 1)
})

test('changing to a valid page size resets to page one and rejects invalid sizes', async () => {
  let changes = 0
  const pagination = useServerPagination(25, () => { changes += 1 })
  pagination.receive({ page: 3, pageSize: 25, total: 72, totalPages: 3 })

  assert.equal(await pagination.changePageSize(50), true)
  assert.equal(pagination.page.value, 1)
  assert.equal(pagination.pageSize.value, 50)
  assert.equal(await pagination.changePageSize(42), false)
  assert.equal(changes, 1)
})

test('request sequence identifies and invalidates stale responses', () => {
  const pagination = useServerPagination()
  const first = pagination.beginRequest()
  const second = pagination.beginRequest()

  assert.equal(pagination.isCurrentRequest(first), false)
  assert.equal(pagination.isCurrentRequest(second), true)
  pagination.invalidateRequests()
  assert.equal(pagination.isCurrentRequest(second), false)
})

test('standalone request sequence invalidates prior table loads', () => {
  const sequence = createRequestSequence()
  const first = sequence.begin()
  const second = sequence.begin()

  assert.equal(sequence.isCurrent(first), false)
  assert.equal(sequence.isCurrent(second), true)
  sequence.invalidate()
  assert.equal(sequence.isCurrent(second), false)
})
