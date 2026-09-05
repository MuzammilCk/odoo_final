import { prisma } from './src/lib/prisma.js';
import { createQuotation } from './src/modules/quotations/quotation.service.js';

async function verifyAdminBlocked() {
  console.log('\n--- VERIFYING ADMIN QUOTATION CREATION LOCKOUT ---');

  const admin = await prisma.user.findFirst({ where: { email: 'admin@demo.com' } });
  const rep = await prisma.user.findFirst({ where: { email: 'rep@demo.com' } });
  const customer = await prisma.customer.findFirst({ where: { isActive: true } });

  if (!admin || !rep || !customer) {
    throw new Error('Required fixtures not found');
  }

  // Test 1: Service Layer Check
  let serviceBlocked = false;
  try {
    await createQuotation(admin.id, customer.id, 'USD');
  } catch (err: any) {
    serviceBlocked = true;
    console.log(`✓ Service layer blocked admin: "${err.message}"`);
  }

  if (!serviceBlocked) {
    throw new Error('SECURITY FAILURE: Admin was able to create quotation in service layer!');
  }

  // Test 2: HTTP Endpoint RBAC check (POST /api/v1/internal/quotations)
  // Login as admin
  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'demo123' }),
  });
  const adminAuth = await loginRes.json() as { token: string };

  const createRes = await fetch('http://localhost:3001/api/v1/internal/quotations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerId: customer.id, currencyCode: 'USD' }),
  });

  console.log(`✓ HTTP API status for admin creating quote: ${createRes.status} ${createRes.statusText}`);
  const errBody = await createRes.json();
  console.log(`✓ Error response:`, JSON.stringify(errBody));

  if (createRes.status !== 403) {
    throw new Error(`SECURITY FAILURE: Expected 403 Forbidden for admin, got ${createRes.status}`);
  }

  // Test 3: Sales Rep can still create quotation
  const repLogin = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rep@demo.com', password: 'demo123' }),
  });
  const repAuth = await repLogin.json() as { token: string };

  const repCreateRes = await fetch('http://localhost:3001/api/v1/internal/quotations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${repAuth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerId: customer.id, currencyCode: 'USD' }),
  });

  console.log(`✓ HTTP API status for sales rep creating quote: ${repCreateRes.status}`);
  if (repCreateRes.status !== 201) {
    throw new Error(`Expected 201 Created for sales rep, got ${repCreateRes.status}`);
  }

  console.log('\n✅ ALL CHECKS PASSED: ADMIN IS COMPLETELY PROHIBITED FROM CREATING QUOTATIONS!\n');
}

verifyAdminBlocked()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
