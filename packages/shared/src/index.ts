// ── Enums (mirror prisma schema exactly) ──────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  SALES_REP = 'SALES_REP',
  MANAGER = 'MANAGER',
  FINANCE_OPS = 'FINANCE_OPS',
  CUSTOMER = 'CUSTOMER',
}

export enum QuotationStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  UNDER_NEGOTIATION = 'UNDER_NEGOTIATION',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
}

export enum FulfillmentStatus {
  SPLIT_PENDING = 'SPLIT_PENDING',
  PARTIAL = 'PARTIAL',
  BACKORDER = 'BACKORDER',
  FULFILLED = 'FULFILLED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  VOID = 'VOID',
}

export enum InvoiceType {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
}

export enum BillingInterval {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export enum BackorderStatus {
  OPEN = 'OPEN',
  PARTIALLY_RESOLVED = 'PARTIALLY_RESOLVED',
  RESOLVED = 'RESOLVED',
}

export enum NegotiationRequestType {
  COMMENT = 'COMMENT',
  CHANGE_REQUEST = 'CHANGE_REQUEST',
  COUNTER_DISCOUNT = 'COUNTER_DISCOUNT',
  DELIVERY_DATE = 'DELIVERY_DATE',
}

export enum NegotiationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  RESOLVED = 'RESOLVED',
}

export enum DealHealthFlagType {
  STALLED = 'STALLED',
  DISCOUNT_ANOMALY = 'DISCOUNT_ANOMALY',
  DELIVERY_SLIPPAGE = 'DELIVERY_SLIPPAGE',
}

export enum LineType {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
}

// ── Risk levels (used in Contract 1) ──────────────────────────────────────────
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Contract 1 return shape ────────────────────────────────────────────────────
export interface EvaluateAndRouteResult {
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  riskScore: number;
}

// ── Contract 2 return shape ────────────────────────────────────────────────────
export interface ResolvePriceResult {
  unitPrice: number;
  source: 'PRICE_LIST' | 'BASE';
}

// ── API error shape ────────────────────────────────────────────────────────────
export interface ApiError {
  error: string;
  details?: unknown;
}
