# ARCHITECTURE & DATA MODEL

## Flow
Frontend ? API ? Firestore

## Collections

### customers
- id
- name
- active
- createdAt
- addedBy

### memberships
- email (uniek)
- customerId
- role
- createdAt / updatedAt

### boxes
- id
- boxId
- siteId
- customerId

### customerBoxAccess
Doc ID = customerId__boxId

- customerId
- boxId
- active
- updatedAt

## API
- /admin/customers
- /admin/memberships
- /admin/customer-box-access
- /admin/boxes

## Security
- requirePlatformAdmin()
- role check via memberships

## Rules
- frontend geen Firestore
- API beslist alles
