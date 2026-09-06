/**
 * Report Export Service — PDF, Excel (XLSX), and CSV generation
 *
 * Spec refs: §A7 (Reporting & Dashboard Configuration: Export options: PDF / XLS),
 *            UC-21–22, Excalidraw Screen 15
 *
 * Implements complete sales-operation lifecycle reporting:
 * Sales Activity → Approval Bottlenecks → Discount Behaviour → Fulfillment Outcomes → Billing/Payment Performance
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { ReportFilters } from './reporting.service.js';

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d?: Date | string | null): string {
  if (!d) return 'N/A';
  return new Date(d).toISOString().slice(0, 10);
}

function formatFilterSummary(filters: ReportFilters = {}): string {
  const parts: string[] = [];
  if (filters.periodPreset === 'today') parts.push('Period: Today');
  else if (filters.periodPreset === 'week') parts.push('Period: This Week');
  else if (filters.startDate || filters.endDate) {
    parts.push(`Period: ${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`);
  } else {
    parts.push('Period: All Time (Full Lifecycle)');
  }

  if (filters.salesRepId && filters.salesRepId !== 'ALL') parts.push(`Sales Rep: ${filters.salesRepId.slice(0, 8)}...`);
  if (filters.approvalStatus && filters.approvalStatus !== 'ALL') parts.push(`Approval Status: ${filters.approvalStatus}`);
  if (filters.categoryId && filters.categoryId !== 'ALL') parts.push(`Category: Filtered`);
  if (filters.productId && filters.productId !== 'ALL') parts.push(`Product: Filtered`);

  return parts.join('  |  ');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReportPdf(
  reportType: string,
  data: any,
  filters: ReportFilters = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      if (reportType === 'product-performance') {
        renderProductOnlyPdf(doc, data, filters);
      } else if (reportType === 'approval-summary') {
        renderApprovalOnlyPdf(doc, data, filters);
      } else if (reportType === 'sales-performance') {
        renderSalesOnlyPdf(doc, data, filters);
      } else {
        // Default: Full Sales Operations Lifecycle Report
        renderFullOperationsPdf(doc, data, filters);
      }

      // ── Running Footers across all buffered pages ──
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.rect(40, 795, 515, 0.75).fill('#e2e8f0');
        doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8').text(
          'DealFlow360 Commercial Sales Operations Platform — Confidential Management Report',
          40,
          804,
          { width: 380, lineBreak: false },
        );
        doc.text(`Page ${i + 1} of ${range.count}`, 420, 804, { width: 135, align: 'right', lineBreak: false });
        doc.page.margins.bottom = oldBottom;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function checkPageBreak(doc: PDFKit.PDFDocument, curY: number, neededHeight: number, title?: string): number {
  if (curY + neededHeight > 760) {
    doc.addPage();
    // Mini running header on subsequent pages
    doc.rect(40, 25, 515, 20).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('DealFlow360', 50, 31, { lineBreak: false });
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text(
      `Sales Operations Report — Continued ${title ? `(${title})` : ''}`,
      125,
      32,
      { lineBreak: false },
    );
    return 60;
  }
  return curY;
}

function renderMetricCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accentColor = '#2563eb',
) {
  doc.roundedRect(x, y, w, h, 4).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.roundedRect(x, y, 3.5, h, 2).fill(accentColor);
  doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text(label.toUpperCase(), x + 8, y + 7, { width: w - 14, lineBreak: false });
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(value, x + 8, y + 22, { width: w - 14, lineBreak: false });
}

// ── Complete Sales Operations Report (10 Lifecycle Sections) ─────────────────

function renderFullOperationsPdf(doc: PDFKit.PDFDocument, data: any, filters: ReportFilters) {
  const kpis = data?.kpis || {};
  const filterDesc = formatFilterSummary(filters);

  // 1. Report Header Banner
  doc.roundedRect(40, 40, 515, 68, 6).fill('#0f172a');

  doc.roundedRect(52, 51, 28, 28, 6).fill('#2563eb');
  doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text('D', 61, 57, { lineBreak: false });

  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('DealFlow360', 88, 51, { lineBreak: false });
  doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8').text('Intelligent Self-Governing B2B Sales Operations & CPQ Engine', 88, 70, { lineBreak: false });

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#38bdf8').text(`Exported: ${dateStr}`, 320, 52, { width: 220, align: 'right', lineBreak: false });
  doc.fontSize(7.5).font('Helvetica').fillColor('#cbd5e1').text(filterDesc, 200, 70, { width: 340, align: 'right', lineBreak: false });

  // Document Title
  doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('DealFlow360 Sales Operations Report', 40, 122, { width: 515, lineBreak: false });
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('End-to-End Governance: Sales Activity > Approvals > Discounts > Fulfillment > Billing > Deal Health', 40, 140, { width: 515, lineBreak: false });

  // 2. Executive KPI Summary (5 Stat Cards)
  let curY = 160;
  const cardW = 98;
  const cardH = 44;
  const cardGap = 6.25;

  renderMetricCard(doc, 40, curY, cardW, cardH, 'Total Quotes', String(kpis.totalQuotations || 0), '#2563eb');
  renderMetricCard(doc, 40 + (cardW + cardGap), curY, cardW, cardH, 'Confirmed Value', formatCurrency(kpis.confirmedValue || 0), '#10b981');
  renderMetricCard(doc, 40 + (cardW + cardGap) * 2, curY, cardW, cardH, 'Avg Margin %', `${kpis.avgMarginPct || 0}%`, '#6366f1');
  renderMetricCard(doc, 40 + (cardW + cardGap) * 3, curY, cardW, cardH, 'Pending Approvals', String(kpis.pendingApprovalsCount || 0), '#f59e0b');
  renderMetricCard(doc, 40 + (cardW + cardGap) * 4, curY, cardW, cardH, 'Outstanding A/R', formatCurrency(kpis.outstandingBalance || 0), '#ef4444');

  curY += cardH + 20;

  // 3. Sales Performance & Representative Leaderboard
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('1. Sales Performance by Representative', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('SALES REPRESENTATIVE', 48, curY + 6, { width: 170, lineBreak: false });
  doc.text('TOTAL QUOTES', 220, curY + 6, { width: 65, align: 'right', lineBreak: false });
  doc.text('WIN RATE', 290, curY + 6, { width: 55, align: 'right', lineBreak: false });
  doc.text('PIPELINE REVENUE', 350, curY + 6, { width: 100, align: 'right', lineBreak: false });
  doc.text('CONFIRMED ORDERS', 455, curY + 6, { width: 95, align: 'right', lineBreak: false });
  curY += 20;

  const topReps = data?.salesRepPerformance || [];
  if (topReps.length === 0) {
    doc.rect(40, curY, 515, 18).fillAndStroke('#ffffff', '#f1f5f9');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No sales representative quotation activity in this period.', 48, curY + 5, { lineBreak: false });
    curY += 18;
  } else {
    topReps.slice(0, 5).forEach((r: any, idx: number) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, curY, 515, 18).fillAndStroke(bg, '#f1f5f9');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      doc.text(r.repName || 'Unknown Rep', 48, curY + 5, { width: 170, lineBreak: false });
      doc.text(String(r.totalQuotes || 0), 220, curY + 5, { width: 65, align: 'right', lineBreak: false });
      doc.text(`${r.winRate || 0}%`, 290, curY + 5, { width: 55, align: 'right', lineBreak: false });
      doc.text(formatCurrency(r.pipelineRevenue || 0), 350, curY + 5, { width: 100, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCurrency(r.confirmedRevenue || 0), 455, curY + 5, { width: 95, align: 'right', lineBreak: false });
      curY += 18;
    });
  }

  curY += 18;

  // 4. Quotation & Pipeline Stage Analysis
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('2. Quotation & Commercial Pipeline Velocity', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('LIFECYCLE STAGE', 48, curY + 6, { width: 220, lineBreak: false });
  doc.text('DEAL COUNT', 270, curY + 6, { width: 90, align: 'right', lineBreak: false });
  doc.text('PIPELINE VALUE', 365, curY + 6, { width: 100, align: 'right', lineBreak: false });
  doc.text('% SHARE', 475, curY + 6, { width: 70, align: 'right', lineBreak: false });
  curY += 20;

  const pipelineStages = data?.pipelineStages || [];
  pipelineStages.forEach((ps: any, idx: number) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(40, curY, 515, 18).fillAndStroke(bg, '#f1f5f9');
    doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
    doc.text(ps.label || ps.status, 48, curY + 5, { width: 220, lineBreak: false });
    doc.text(String(ps.count || 0), 270, curY + 5, { width: 90, align: 'right', lineBreak: false });
    doc.text(formatCurrency(ps.totalValue || 0), 365, curY + 5, { width: 100, align: 'right', lineBreak: false });
    doc.font('Helvetica-Bold').text(`${ps.percentage || 0}%`, 475, curY + 5, { width: 70, align: 'right', lineBreak: false });
    curY += 18;
  });

  curY += 18;

  // Check if we need page 2
  curY = checkPageBreak(doc, curY, 140, 'Approvals & Governance');

  // 5. Approval Analysis & Governance Bottlenecks
  const appGov = data?.approvalGovernance || {};
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('3. Approval Governance & Velocity Bottlenecks', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  // Mini summary row
  doc.roundedRect(40, curY, 515, 26, 4).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#334155').fontSize(8).font('Helvetica');
  doc.text(
    `Total Requests: ${appGov.totalApprovalRequests || 0}   |   Approved: ${appGov.approvedRequests || 0}   |   Rejected: ${appGov.rejectedRequests || 0}   |   Pending: ${appGov.pendingRequests || 0}   |   Manager Steps: ${appGov.managerSteps || 0}   |   Finance Steps: ${appGov.financeSteps || 0}   |   Avg Turnaround: ${appGov.avgTurnaroundHours || 0}h`,
    50,
    curY + 9,
    { width: 495, lineBreak: false },
  );
  curY += 32;

  // Bottleneck deals table if pending
  if (appGov.bottlenecks && appGov.bottlenecks.length > 0) {
    doc.rect(40, curY, 515, 18).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    doc.text('PENDING DEAL', 48, curY + 5, { width: 100, lineBreak: false });
    doc.text('CUSTOMER', 150, curY + 5, { width: 140, lineBreak: false });
    doc.text('RISK SCORE', 295, curY + 5, { width: 65, align: 'right', lineBreak: false });
    doc.text('REQUIRED GATE', 365, curY + 5, { width: 95, lineBreak: false });
    doc.text('WAIT TIME', 465, curY + 5, { width: 85, align: 'right', lineBreak: false });
    curY += 18;

    appGov.bottlenecks.slice(0, 4).forEach((b: any, idx: number) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, curY, 515, 17).fillAndStroke(bg, '#f1f5f9');
      doc.fillColor('#1e293b').fontSize(7.5).font('Helvetica');
      doc.text(b.quoteNumber, 48, curY + 5, { width: 100, lineBreak: false });
      doc.text(b.customerName, 150, curY + 5, { width: 140, lineBreak: false });
      doc.text(String(b.riskScore), 295, curY + 5, { width: 65, align: 'right', lineBreak: false });
      doc.text(b.requiredLevel, 365, curY + 5, { width: 95, lineBreak: false });
      doc.text(`${b.waitingHours} hrs`, 465, curY + 5, { width: 85, align: 'right', lineBreak: false });
      curY += 17;
    });
    curY += 14;
  }

  // 6. Discount & Margin Discipline
  curY = checkPageBreak(doc, curY, 110, 'Discount Analysis');
  const discAnalysis = data?.discountAnalysis || {};
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('4. Discount Analysis & Risk Tier Distribution', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.roundedRect(40, curY, 515, 26, 4).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#334155').fontSize(8).font('Helvetica');
  const rl = discAnalysis.riskLevelsCount || {};
  doc.text(
    `Total Discounts: ${formatCurrency(discAnalysis.totalDiscountAmount || 0)}   |   Avg Discount: ${discAnalysis.avgDiscountPercent || 0}%   |   Avg Risk Score: ${discAnalysis.avgRiskScore || 0}   |   Risk Distribution: Low (${rl.LOW || 0})  /  Medium (${rl.MEDIUM || 0})  /  High (${rl.HIGH || 0})`,
    50,
    curY + 9,
    { width: 495, lineBreak: false },
  );
  curY += 36;

  // 7. Product & Category Performance
  curY = checkPageBreak(doc, curY, 130, 'Product Performance');
  const prodPerf = data?.productPerformance || {};
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('5. Top Products & Revenue Breakdown', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('PRODUCT NAME', 48, curY + 6, { width: 170, lineBreak: false });
  doc.text('CATEGORY', 225, curY + 6, { width: 105, lineBreak: false });
  doc.text('QTY SOLD', 335, curY + 6, { width: 60, align: 'right', lineBreak: false });
  doc.text('AVG DISC %', 400, curY + 6, { width: 60, align: 'right', lineBreak: false });
  doc.text('REVENUE', 465, curY + 6, { width: 85, align: 'right', lineBreak: false });
  curY += 20;

  const topProds = prodPerf.topProducts || [];
  if (topProds.length === 0) {
    doc.rect(40, curY, 515, 18).fillAndStroke('#ffffff', '#f1f5f9');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('No product sales recorded in this period.', 48, curY + 5, { lineBreak: false });
    curY += 18;
  } else {
    topProds.slice(0, 5).forEach((p: any, idx: number) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, curY, 515, 18).fillAndStroke(bg, '#f1f5f9');
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
      doc.text(p.name || 'Unknown', 48, curY + 5, { width: 170, lineBreak: false, ellipsis: true });
      doc.text(p.category || 'Unassigned', 225, curY + 5, { width: 105, lineBreak: false });
      doc.text(String(p.quantitySold || 0), 335, curY + 5, { width: 60, align: 'right', lineBreak: false });
      doc.text(`${p.avgDiscountPct || 0}%`, 400, curY + 5, { width: 60, align: 'right', lineBreak: false });
      doc.font('Helvetica-Bold').text(formatCurrency(p.revenue || 0), 465, curY + 5, { width: 85, align: 'right', lineBreak: false });
      curY += 18;
    });
  }

  curY += 18;

  // 8. Fulfillment Summary (Multi-Warehouse Splits)
  curY = checkPageBreak(doc, curY, 110, 'Fulfillment Summary');
  const fulf = data?.fulfillmentSummary || {};
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('6. Multi-Warehouse Fulfillment & Backorders', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.roundedRect(40, curY, 515, 26, 4).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#334155').fontSize(8).font('Helvetica');
  doc.text(
    `Total Allocations: ${fulf.totalAllocations || 0}   |   Qty Allocated: ${fulf.totalAllocatedQty || 0}   |   Qty Fulfilled: ${fulf.totalFulfilledQty || 0}   |   Backordered Qty: ${fulf.totalBackorderedQty || 0}   |   Est. Logistics Cost: ${formatCurrency(fulf.totalShippingCost || 0)}`,
    50,
    curY + 9,
    { width: 495, lineBreak: false },
  );
  curY += 36;

  // 9. Billing & Payment Collections (Hybrid Billing)
  curY = checkPageBreak(doc, curY, 110, 'Billing Summary');
  const bill = data?.billingSummary || {};
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('7. Hybrid Billing & Payment Reconciliation', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.roundedRect(40, curY, 515, 26, 4).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#334155').fontSize(8).font('Helvetica');
  doc.text(
    `One-Time Billed: ${formatCurrency(bill.oneTimeBilled || 0)}   |   Subscription Billed: ${formatCurrency(bill.recurringBilled || 0)}   |   Total Invoiced: ${formatCurrency(bill.totalInvoiced || 0)}   |   Total Collected: ${formatCurrency(bill.totalPaid || 0)}   |   Balance Due: ${formatCurrency(bill.outstandingBalance || 0)}`,
    50,
    curY + 9,
    { width: 495, lineBreak: false },
  );
  curY += 36;

  // 10. Deal Health & Operational Exceptions
  curY = checkPageBreak(doc, curY, 100, 'Deal Health');
  const dh = data?.dealHealthSummary || {};
  doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('8. Deal Health & Operational Anomaly Exceptions', 40, curY, { width: 515, lineBreak: false });
  curY += 16;

  doc.roundedRect(40, curY, 515, 26, 4).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fillColor('#334155').fontSize(8).font('Helvetica');
  doc.text(
    `Total Open Exceptions: ${dh.totalOpenExceptions || 0}   |   Stalled Deals (>7d inactive): ${dh.stalledCount || 0}   |   Discount Anomalies: ${dh.anomalyCount || 0}   |   Delivery Promise Slippage: ${dh.slippageCount || 0}`,
    50,
    curY + 9,
    { width: 495, lineBreak: false },
  );
}

// ── Legacy Single-Focus PDF Generators ────────────────────────────────────────

function renderSalesOnlyPdf(doc: PDFKit.PDFDocument, data: any, filters: ReportFilters) {
  renderFullOperationsPdf(doc, data, filters);
}

function renderProductOnlyPdf(doc: PDFKit.PDFDocument, data: any, filters: ReportFilters) {
  renderFullOperationsPdf(doc, data, filters);
}

function renderApprovalOnlyPdf(doc: PDFKit.PDFDocument, data: any, filters: ReportFilters) {
  renderFullOperationsPdf(doc, data, filters);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXCEL (XLSX) GENERATOR (6 Dedicated Structured Sheets)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReportXls(
  reportType: string,
  data: any,
  filters: ReportFilters = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DealFlow360';
  workbook.created = new Date();

  // ── SHEET 1: Executive Summary ──────────────────────────────────────────────
  const sSummary = workbook.addWorksheet('Executive Summary', { views: [{ showGridLines: true }] });
  buildExecutiveSummarySheet(sSummary, data, filters);

  // ── SHEET 2: Quotations ─────────────────────────────────────────────────────
  const sQuotes = workbook.addWorksheet('Quotations', { views: [{ showGridLines: true }] });
  buildQuotationsSheet(sQuotes, data);

  // ── SHEET 3: Products ───────────────────────────────────────────────────────
  const sProducts = workbook.addWorksheet('Products', { views: [{ showGridLines: true }] });
  buildProductsSheet(sProducts, data);

  // ── SHEET 4: Approvals ──────────────────────────────────────────────────────
  const sApprovals = workbook.addWorksheet('Approvals', { views: [{ showGridLines: true }] });
  buildApprovalsSheet(sApprovals, data);

  // ── SHEET 5: Fulfillment ────────────────────────────────────────────────────
  const sFulfillment = workbook.addWorksheet('Fulfillment', { views: [{ showGridLines: true }] });
  buildFulfillmentSheet(sFulfillment, data);

  // ── SHEET 6: Billing ────────────────────────────────────────────────────────
  const sBilling = workbook.addWorksheet('Billing', { views: [{ showGridLines: true }] });
  buildBillingSheet(sBilling, data);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Sheet Builders ────────────────────────────────────────────────────────────

function applyHeaderStyle(row: ExcelJS.Row, colCount: number) {
  row.height = 24;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = Math.min(len, 45);
    });
    col.width = maxLen + 3;
  });
}

function buildExecutiveSummarySheet(sheet: ExcelJS.Worksheet, data: any, filters: ReportFilters) {
  const kpis = data?.kpis || {};
  const filterDesc = formatFilterSummary(filters);

  sheet.mergeCells('A1:E1');
  const title = sheet.getCell('A1');
  title.value = 'DealFlow360 — Sales Operations Executive Report';
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;

  sheet.mergeCells('A2:E2');
  const meta = sheet.getCell('A2');
  meta.value = `Exported: ${new Date().toISOString()}  |  ${filterDesc}`;
  meta.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  let rIdx = 4;
  sheet.getCell(`A${rIdx}`).value = 'EXECUTIVE KPI';
  sheet.getCell(`B${rIdx}`).value = 'VALUE';
  applyHeaderStyle(sheet.getRow(rIdx), 2);
  rIdx++;

  const kpiRows = [
    ['Total Quotations In Pipeline', kpis.totalQuotations || 0, '#,##0'],
    ['Total Pipeline Value', kpis.pipelineValue || 0, '$#,##0.00'],
    ['Confirmed Orders Revenue', kpis.confirmedValue || 0, '$#,##0.00'],
    ['Average Deal Size', kpis.avgDealSize || 0, '$#,##0.00'],
    ['Average Commercial Margin %', (kpis.avgMarginPct || 0) / 100, '0.0%'],
    ['Total Discounts Applied', kpis.totalDiscounts || 0, '$#,##0.00'],
    ['Pending Governance Approvals', kpis.pendingApprovalsCount || 0, '#,##0'],
    ['Total Invoiced Amount', kpis.totalInvoiced || 0, '$#,##0.00'],
    ['Total Payments Collected', kpis.totalPaid || 0, '$#,##0.00'],
    ['Outstanding Receivables Balance', kpis.outstandingBalance || 0, '$#,##0.00'],
  ];

  kpiRows.forEach(([kpi, val, fmt]) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = kpi;
    const cVal = row.getCell(2);
    cVal.value = Number(val);
    cVal.numFmt = fmt as string;
    rIdx++;
  });

  rIdx += 2;

  // Pipeline by Status table
  sheet.getCell(`A${rIdx}`).value = 'LIFECYCLE STAGE';
  sheet.getCell(`B${rIdx}`).value = 'DEAL COUNT';
  sheet.getCell(`C${rIdx}`).value = 'PIPELINE VALUE';
  sheet.getCell(`D${rIdx}`).value = '% SHARE';
  applyHeaderStyle(sheet.getRow(rIdx), 4);
  rIdx++;

  (data?.pipelineStages || []).forEach((ps: any) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = ps.label || ps.status;
    row.getCell(2).value = Number(ps.count);
    const cVal = row.getCell(3);
    cVal.value = Number(ps.totalValue);
    cVal.numFmt = '$#,##0.00';
    const cPct = row.getCell(4);
    cPct.value = Number(ps.percentage) / 100;
    cPct.numFmt = '0.0%';
    rIdx++;
  });

  autoFitColumns(sheet);
}

function buildQuotationsSheet(sheet: ExcelJS.Worksheet, data: any) {
  const headers = [
    'Quote Number',
    'Customer',
    'Sales Rep',
    'Created Date',
    'Status',
    'Subtotal',
    'Discount Total',
    'Grand Total',
    'Margin %',
    'Risk Level',
    'Blended Risk Score',
  ];

  const headerRow = sheet.getRow(1);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeaderStyle(headerRow, headers.length);

  let rIdx = 2;
  (data?.detailedQuotations || []).forEach((q: any) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = q.quoteNumber;
    row.getCell(2).value = q.customerName;
    row.getCell(3).value = q.salesRepName;
    row.getCell(4).value = formatDate(q.createdAt);
    row.getCell(5).value = q.status;
    const cSub = row.getCell(6);
    cSub.value = Number(q.subtotal);
    cSub.numFmt = '$#,##0.00';
    const cDisc = row.getCell(7);
    cDisc.value = Number(q.discountTotal);
    cDisc.numFmt = '$#,##0.00';
    const cTot = row.getCell(8);
    cTot.value = Number(q.grandTotal);
    cTot.numFmt = '$#,##0.00';
    const cMarg = row.getCell(9);
    cMarg.value = Number(q.marginPercent) / 100;
    cMarg.numFmt = '0.0%';
    row.getCell(10).value = q.riskLevel;
    row.getCell(11).value = Number(q.blendedRiskScore);
    rIdx++;
  });

  autoFitColumns(sheet);
}

function buildProductsSheet(sheet: ExcelJS.Worksheet, data: any) {
  const headers = ['Product Name', 'SKU', 'Category', 'Quantity Sold', 'Revenue', 'Avg Discount %', 'Orders Count'];
  const headerRow = sheet.getRow(1);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeaderStyle(headerRow, headers.length);

  let rIdx = 2;
  (data?.productPerformance?.topProducts || []).forEach((p: any) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = p.name;
    row.getCell(2).value = p.sku;
    row.getCell(3).value = p.category;
    row.getCell(4).value = Number(p.quantitySold);
    const cRev = row.getCell(5);
    cRev.value = Number(p.revenue);
    cRev.numFmt = '$#,##0.00';
    const cDisc = row.getCell(6);
    cDisc.value = Number(p.avgDiscountPct) / 100;
    cDisc.numFmt = '0.0%';
    row.getCell(7).value = Number(p.ordersCount);
    rIdx++;
  });

  autoFitColumns(sheet);
}

function buildApprovalsSheet(sheet: ExcelJS.Worksheet, data: any) {
  const headers = ['Quote Number', 'Customer', 'Risk Score', 'Risk Level', 'Required Level', 'Submitted At', 'Waiting Hours'];
  const headerRow = sheet.getRow(1);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeaderStyle(headerRow, headers.length);

  let rIdx = 2;
  (data?.approvalGovernance?.bottlenecks || []).forEach((b: any) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = b.quoteNumber;
    row.getCell(2).value = b.customerName;
    row.getCell(3).value = Number(b.riskScore);
    row.getCell(4).value = b.riskLevel;
    row.getCell(5).value = b.requiredLevel;
    row.getCell(6).value = formatDate(b.submittedAt);
    row.getCell(7).value = Number(b.waitingHours);
    rIdx++;
  });

  autoFitColumns(sheet);
}

function buildFulfillmentSheet(sheet: ExcelJS.Worksheet, data: any) {
  const headers = ['Warehouse Name', 'Allocations Count', 'Quantity Allocated', 'Quantity Fulfilled', 'Shipping Cost'];
  const headerRow = sheet.getRow(1);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeaderStyle(headerRow, headers.length);

  let rIdx = 2;
  (data?.fulfillmentSummary?.warehouseBreakdown || []).forEach((w: any) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = w.warehouseName;
    row.getCell(2).value = Number(w.allocationsCount);
    row.getCell(3).value = Number(w.quantityAllocated);
    row.getCell(4).value = Number(w.quantityFulfilled);
    const cCost = row.getCell(5);
    cCost.value = Number(w.shippingCost);
    cCost.numFmt = '$#,##0.00';
    rIdx++;
  });

  autoFitColumns(sheet);
}

function buildBillingSheet(sheet: ExcelJS.Worksheet, data: any) {
  const headers = ['Metric', 'Amount'];
  const headerRow = sheet.getRow(1);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  applyHeaderStyle(headerRow, headers.length);

  const bill = data?.billingSummary || {};
  const rows = [
    ['One-Time Lines Billed', bill.oneTimeBilled || 0],
    ['Recurring Subscription Billed', bill.recurringBilled || 0],
    ['Total Invoiced Amount', bill.totalInvoiced || 0],
    ['Total Payments Recorded', bill.totalPaid || 0],
    ['Total Credit Notes Issued', bill.totalCreditNotes || 0],
    ['Outstanding Accounts Receivable', bill.outstandingBalance || 0],
  ];

  let rIdx = 2;
  rows.forEach(([metric, val]) => {
    const row = sheet.getRow(rIdx);
    row.getCell(1).value = metric;
    const cVal = row.getCell(2);
    cVal.value = Number(val);
    cVal.numFmt = '$#,##0.00';
    rIdx++;
  });

  autoFitColumns(sheet);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CSV GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateReportCsv(reportType: string, data: any): string {
  const lines: string[] = [];

  if (reportType === 'product-performance') {
    lines.push('Product Name,SKU,Category,Quantity Sold,Revenue,Avg Discount %');
    (data?.productPerformance?.topProducts || data?.topProducts || []).forEach((p: any) => {
      lines.push(
        `"${p.name || p.product?.name || ''}","${p.sku || p.product?.sku || ''}","${p.category || ''}",${p.quantitySold || p.totalQty || 0},${p.revenue || p.totalRevenue || 0},${p.avgDiscountPct || 0}`,
      );
    });
  } else {
    // Default: Quotations CSV
    lines.push('Quote Number,Customer,Sales Rep,Date,Status,Total,Discount,Margin %');
    (data?.detailedQuotations || []).forEach((q: any) => {
      lines.push(
        `"${q.quoteNumber}","${q.customerName}","${q.salesRepName}","${formatDate(q.createdAt)}","${q.status}",${q.grandTotal},${q.discountTotal},${q.marginPercent}`,
      );
    });
  }

  return lines.join('\n');
}
