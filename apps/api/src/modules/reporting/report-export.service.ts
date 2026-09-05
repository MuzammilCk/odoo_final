/**
 * Report Export Service — PDF, Excel (XLSX), and CSV generation
 *
 * Spec refs: §A7 (Reporting & Dashboard Configuration: Export options: PDF / XLS),
 *            UC-21–22, Excalidraw Screen 15
 */

import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  salesRepId?: string;
  categoryId?: string;
  status?: string;
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d?: Date): string {
  if (!d) return 'N/A';
  return new Date(d).toISOString().slice(0, 10);
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
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const titleMap: Record<string, string> = {
        'sales-performance': 'Sales & Commercial Performance Report',
        'product-performance': 'Product Performance & Revenue Breakdown',
        'approval-summary': 'Approval Velocity & Governance Summary',
      };

      const title = titleMap[reportType] || 'Executive Business Analytics Report';

      // ── Header Banner ──
      doc.rect(40, 40, 515, 60).fill('#0f172a');

      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('DealFlow360', 55, 52);
      doc.fontSize(9).font('Helvetica').fillColor('#94a3b8').text('Commercial Sales Operations & Revenue Governance', 55, 75);

      doc.fontSize(8).fillColor('#38bdf8').text(`Generated: ${new Date().toLocaleString()}`, 380, 55, { align: 'right' });
      const filterRange = filters.startDate || filters.endDate
        ? `Period: ${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`
        : 'Period: All Time';
      doc.fillColor('#cbd5e1').text(filterRange, 380, 72, { align: 'right' });

      doc.y = 120;

      // ── Report Title ──
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(title, 40, doc.y);
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Automated operational intelligence exported from DealFlow360 live database.');
      doc.moveDown(1.5);

      // ── Report Content by Type ──
      if (reportType === 'sales-performance') {
        renderSalesPdf(doc, data);
      } else if (reportType === 'product-performance') {
        renderProductPdf(doc, data);
      } else if (reportType === 'approval-summary') {
        renderApprovalPdf(doc, data);
      } else {
        doc.fillColor('#0f172a').fontSize(10).text(JSON.stringify(data, null, 2));
      }

      // ── Footer ──
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.rect(40, 785, 515, 0.5).fill('#cbd5e1');
        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(
          'DealFlow360 Confidential Commercial Document — Generated for Executive & Sales Operations',
          40,
          795,
          { width: 350 },
        );
        doc.text(`Page ${i + 1} of ${range.count}`, 455, 795, { width: 100, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderMetricBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accentColor = '#2563eb',
) {
  doc.rect(x, y, w, h).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.rect(x, y, 4, h).fill(accentColor);
  doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text(label.toUpperCase(), x + 10, y + 8, { width: w - 15 });
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(value, x + 10, y + 23, { width: w - 15 });
}

function renderSalesPdf(doc: PDFKit.PDFDocument, data: any) {
  const summary = data?.summary || {};

  // KPI Cards Row
  const startY = doc.y;
  const boxW = 120;
  const boxH = 45;
  const gap = 11;

  renderMetricBox(doc, 40, startY, boxW, boxH, 'Total Revenue', formatCurrency(summary.totalRevenue || 0), '#10b981');
  renderMetricBox(doc, 40 + (boxW + gap), startY, boxW, boxH, 'Total Quotations', String(summary.totalQuotations || 0), '#2563eb');
  renderMetricBox(doc, 40 + (boxW + gap) * 2, startY, boxW, boxH, 'Avg Deal Size', formatCurrency(summary.avgDealSize || 0), '#6366f1');
  renderMetricBox(doc, 40 + (boxW + gap) * 3, startY, boxW, boxH, 'Total Discounts', formatCurrency(summary.totalDiscounts || 0), '#f59e0b');

  doc.y = startY + boxH + 25;

  // Table 1: Status Breakdown
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Commercial Pipeline by Quotation Status');
  doc.moveDown(0.5);

  let curY = doc.y;
  const colX = [40, 220, 360, 470];

  // Header
  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('QUOTATION STATUS', colX[0] + 8, curY + 6);
  doc.text('DEAL COUNT', colX[1], curY + 6, { width: 100, align: 'right' });
  doc.text('TOTAL REVENUE', colX[2], curY + 6, { width: 130, align: 'right' });
  curY += 20;

  const byStatus = data?.byStatus || [];
  byStatus.forEach((item: any, idx: number) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(40, curY, 515, 20).fill(bg);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
    doc.text(item.status || 'UNKNOWN', colX[0] + 8, curY + 6);
    doc.text(String(item.count || 0), colX[1], curY + 6, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCurrency(item.revenue || 0), colX[2], curY + 6, { width: 130, align: 'right' });
    curY += 20;
  });

  doc.y = curY + 25;

  // Table 2: Top Sales Reps
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Top Sales Performers');
  doc.moveDown(0.5);

  curY = doc.y;
  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('RANK & SALES REPRESENTATIVE', colX[0] + 8, curY + 6);
  doc.text('DEALS CLOSED', colX[1], curY + 6, { width: 100, align: 'right' });
  doc.text('TOTAL REVENUE', colX[2], curY + 6, { width: 130, align: 'right' });
  curY += 20;

  const topReps = data?.topReps || [];
  if (topReps.length === 0) {
    doc.rect(40, curY, 515, 20).fill('#ffffff');
    doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text('No sales rep data recorded for period.', colX[0] + 8, curY + 6);
    curY += 20;
  } else {
    topReps.forEach((rep: any, idx: number) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, curY, 515, 20).fill(bg);
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
      doc.text(`#${idx + 1}  ${rep.repName || 'Unknown'}`, colX[0] + 8, curY + 6);
      doc.text(String(rep.count || 0), colX[1], curY + 6, { width: 100, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCurrency(rep.revenue || 0), colX[2], curY + 6, { width: 130, align: 'right' });
      curY += 20;
    });
  }
}

function renderProductPdf(doc: PDFKit.PDFDocument, data: any) {
  let curY = doc.y;
  const colX = [40, 200, 290, 370, 450];

  // Table 1: Top Products
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Top Products by Commercial Volume & Revenue');
  doc.moveDown(0.5);

  curY = doc.y;
  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('PRODUCT NAME', colX[0] + 8, curY + 6);
  doc.text('SKU', colX[1], curY + 6);
  doc.text('ORDERS', colX[2], curY + 6, { width: 60, align: 'right' });
  doc.text('QTY SOLD', colX[3], curY + 6, { width: 60, align: 'right' });
  doc.text('REVENUE', colX[4] - 20, curY + 6, { width: 115, align: 'right' });
  curY += 20;

  const topProducts = data?.topProducts || [];
  if (topProducts.length === 0) {
    doc.rect(40, curY, 515, 20).fill('#ffffff');
    doc.fillColor('#64748b').fontSize(8.5).font('Helvetica').text('No product quotation records for period.', colX[0] + 8, curY + 6);
    curY += 20;
  } else {
    topProducts.forEach((item: any, idx: number) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(40, curY, 515, 20).fill(bg);
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
      doc.text(item.product?.name || 'Unknown Product', colX[0] + 8, curY + 6, { width: 150, ellipsis: true });
      doc.text(item.product?.sku || '-', colX[1], curY + 6);
      doc.text(String(item.timesOrdered || 0), colX[2], curY + 6, { width: 60, align: 'right' });
      doc.text(String(item.totalQty || 0), colX[3], curY + 6, { width: 60, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCurrency(item.totalRevenue || 0), colX[4] - 20, curY + 6, { width: 115, align: 'right' });
      curY += 20;
    });
  }

  doc.y = curY + 25;

  // Table 2: Category Breakdown
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Revenue Breakdown by Product Category');
  doc.moveDown(0.5);

  curY = doc.y;
  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('PRODUCT CATEGORY', 48, curY + 6);
  doc.text('AGGREGATE REVENUE', 350, curY + 6, { width: 195, align: 'right' });
  curY += 20;

  const byCategory = data?.byCategory || [];
  byCategory.forEach((cat: any, idx: number) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(40, curY, 515, 20).fill(bg);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
    doc.text(cat.category || 'Unassigned', 48, curY + 6);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatCurrency(cat.revenue || 0), 350, curY + 6, { width: 195, align: 'right' });
    curY += 20;
  });
}

function renderApprovalPdf(doc: PDFKit.PDFDocument, data: any) {
  const startY = doc.y;
  const boxW = 160;
  const boxH = 45;
  const gap = 15;

  renderMetricBox(doc, 40, startY, boxW, boxH, 'Total Approval Requests', String(data?.totalRequests || 0), '#2563eb');
  renderMetricBox(doc, 40 + (boxW + gap), startY, boxW, boxH, 'Avg Decision Time', `${data?.avgApprovalTimeHours || 0} Hours`, '#10b981');

  doc.y = startY + boxH + 25;

  // Table: Status
  doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Governance Velocity by Status');
  doc.moveDown(0.5);

  let curY = doc.y;
  doc.rect(40, curY, 515, 20).fill('#1e293b');
  doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
  doc.text('DECISION / STAGE STATUS', 48, curY + 6);
  doc.text('COUNT', 350, curY + 6, { width: 195, align: 'right' });
  curY += 20;

  const byStatus = data?.byStatus || [];
  byStatus.forEach((s: any, idx: number) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(40, curY, 515, 20).fill(bg);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica');
    doc.text(s.status || 'PENDING', 48, curY + 6);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(String(s.count || 0), 350, curY + 6, { width: 195, align: 'right' });
    curY += 20;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXCEL (XLSX) GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReportXls(
  reportType: string,
  data: any,
  filters: ReportFilters = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DealFlow360';
  workbook.created = new Date();

  const titleMap: Record<string, string> = {
    'sales-performance': 'Sales Performance',
    'product-performance': 'Product Performance',
    'approval-summary': 'Approval Summary',
  };

  const sheetName = titleMap[reportType] || 'Executive Report';
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Title block
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `DealFlow360 — ${sheetName}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;

  // Metadata row
  sheet.mergeCells('A2:E2');
  const metaCell = sheet.getCell('A2');
  const filterDesc = filters.startDate || filters.endDate
    ? `Filter: ${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`
    : 'Filter: All Time';
  metaCell.value = `Exported: ${new Date().toISOString()}  |  ${filterDesc}`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  sheet.getRow(2).height = 18;

  let rowIdx = 4;

  if (reportType === 'sales-performance') {
    const summary = data?.summary || {};

    // Summary block
    sheet.getCell(`A${rowIdx}`).value = 'METRIC';
    sheet.getCell(`B${rowIdx}`).value = 'VALUE';
    applyHeaderStyle(sheet.getRow(rowIdx), 2);
    rowIdx++;

    const summaryRows = [
      ['Total Pipeline Revenue', summary.totalRevenue || 0, '$#,##0.00'],
      ['Total Quotations', summary.totalQuotations || 0, '#,##0'],
      ['Average Deal Size', summary.avgDealSize || 0, '$#,##0.00'],
      ['Total Discounts Given', summary.totalDiscounts || 0, '$#,##0.00'],
      ['Average Margin %', (summary.avgMarginPct || 0) / 100, '0.0%'],
    ];

    summaryRows.forEach(([metric, val, numFmt]) => {
      const r = sheet.getRow(rowIdx);
      r.getCell(1).value = metric;
      const valCell = r.getCell(2);
      valCell.value = Number(val);
      valCell.numFmt = numFmt as string;
      rowIdx++;
    });

    rowIdx += 2;

    // Status breakdown
    sheet.getCell(`A${rowIdx}`).value = 'QUOTATION STATUS';
    sheet.getCell(`B${rowIdx}`).value = 'COUNT';
    sheet.getCell(`C${rowIdx}`).value = 'TOTAL REVENUE';
    applyHeaderStyle(sheet.getRow(rowIdx), 3);
    rowIdx++;

    (data?.byStatus || []).forEach((item: any) => {
      const r = sheet.getRow(rowIdx);
      r.getCell(1).value = item.status;
      r.getCell(2).value = Number(item.count);
      const revCell = r.getCell(3);
      revCell.value = Number(item.revenue);
      revCell.numFmt = '$#,##0.00';
      rowIdx++;
    });

    rowIdx += 2;

    // Top reps
    sheet.getCell(`A${rowIdx}`).value = 'SALES REPRESENTATIVE';
    sheet.getCell(`B${rowIdx}`).value = 'DEALS CLOSED';
    sheet.getCell(`C${rowIdx}`).value = 'TOTAL REVENUE';
    applyHeaderStyle(sheet.getRow(rowIdx), 3);
    rowIdx++;

    (data?.topReps || []).forEach((rData: any) => {
      const r = sheet.getRow(rowIdx);
      r.getCell(1).value = rData.repName;
      r.getCell(2).value = Number(rData.count);
      const revCell = r.getCell(3);
      revCell.value = Number(rData.revenue);
      revCell.numFmt = '$#,##0.00';
      rowIdx++;
    });
  } else if (reportType === 'product-performance') {
    sheet.getCell(`A${rowIdx}`).value = 'PRODUCT NAME';
    sheet.getCell(`B${rowIdx}`).value = 'SKU';
    sheet.getCell(`C${rowIdx}`).value = 'TIMES ORDERED';
    sheet.getCell(`D${rowIdx}`).value = 'TOTAL QUANTITY';
    sheet.getCell(`E${rowIdx}`).value = 'TOTAL REVENUE';
    applyHeaderStyle(sheet.getRow(rowIdx), 5);
    rowIdx++;

    (data?.topProducts || []).forEach((item: any) => {
      const r = sheet.getRow(rowIdx);
      r.getCell(1).value = item.product?.name || 'Unknown';
      r.getCell(2).value = item.product?.sku || '-';
      r.getCell(3).value = Number(item.timesOrdered || 0);
      r.getCell(4).value = Number(item.totalQty || 0);
      const revCell = r.getCell(5);
      revCell.value = Number(item.totalRevenue || 0);
      revCell.numFmt = '$#,##0.00';
      rowIdx++;
    });

    rowIdx += 2;

    sheet.getCell(`A${rowIdx}`).value = 'PRODUCT CATEGORY';
    sheet.getCell(`B${rowIdx}`).value = 'AGGREGATE REVENUE';
    applyHeaderStyle(sheet.getRow(rowIdx), 2);
    rowIdx++;

    (data?.byCategory || []).forEach((cat: any) => {
      const r = sheet.getRow(rowIdx);
      r.getCell(1).value = cat.category;
      const revCell = r.getCell(2);
      revCell.value = Number(cat.revenue || 0);
      revCell.numFmt = '$#,##0.00';
      rowIdx++;
    });
  } else if (reportType === 'approval-summary') {
    sheet.getCell(`A${rowIdx}`).value = 'APPROVAL METRIC';
    sheet.getCell(`B${rowIdx}`).value = 'VALUE';
    applyHeaderStyle(sheet.getRow(rowIdx), 2);
    rowIdx++;

    sheet.getRow(rowIdx).getCell(1).value = 'Total Approval Requests';
    sheet.getRow(rowIdx).getCell(2).value = Number(data?.totalRequests || 0);
    rowIdx++;

    sheet.getRow(rowIdx).getCell(1).value = 'Avg Approval Time (Hours)';
    sheet.getRow(rowIdx).getCell(2).value = Number(data?.avgApprovalTimeHours || 0);
    rowIdx += 2;

    sheet.getCell(`A${rowIdx}`).value = 'STATUS';
    sheet.getCell(`B${rowIdx}`).value = 'COUNT';
    applyHeaderStyle(sheet.getRow(rowIdx), 2);
    rowIdx++;

    (data?.byStatus || []).forEach((item: any) => {
      const r = sheet.getRow(rowIdx);
      r.getCell(1).value = item.status;
      r.getCell(2).value = Number(item.count);
      rowIdx++;
    });
  }

  // Auto-fit column widths
  sheet.columns.forEach((column) => {
    let maxLen = 14;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellVal = cell.value ? String(cell.value) : '';
      if (cellVal.length > maxLen) {
        maxLen = Math.min(cellVal.length + 3, 50);
      }
    });
    column.width = maxLen;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function applyHeaderStyle(row: ExcelJS.Row, colCount = 3) {
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CSV GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateReportCsv(reportType: string, data: any): string {
  const lines: string[] = [];

  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  if (reportType === 'sales-performance') {
    lines.push('--- SALES PERFORMANCE SUMMARY ---');
    lines.push('Metric,Value');
    lines.push(`Total Revenue,${data?.summary?.totalRevenue ?? 0}`);
    lines.push(`Total Quotations,${data?.summary?.totalQuotations ?? 0}`);
    lines.push(`Average Deal Size,${data?.summary?.avgDealSize ?? 0}`);
    lines.push(`Total Discounts,${data?.summary?.totalDiscounts ?? 0}`);
    lines.push(`Average Margin Pct,${data?.summary?.avgMarginPct ?? 0}`);
    lines.push('');
    lines.push('--- BY STATUS ---');
    lines.push('Status,Count,Revenue');
    (data?.byStatus || []).forEach((s: any) => {
      lines.push(`${escape(s.status)},${s.count},${s.revenue}`);
    });
    lines.push('');
    lines.push('--- TOP SALES REPS ---');
    lines.push('Rep ID,Rep Name,Deals Closed,Revenue');
    (data?.topReps || []).forEach((r: any) => {
      lines.push(`${escape(r.repId)},${escape(r.repName)},${r.count},${r.revenue}`);
    });
  } else if (reportType === 'product-performance') {
    lines.push('--- TOP PRODUCTS ---');
    lines.push('Product ID,Product Name,SKU,Times Ordered,Total Quantity,Total Revenue');
    (data?.topProducts || []).forEach((p: any) => {
      lines.push(`${escape(p.product?.id)},${escape(p.product?.name)},${escape(p.product?.sku)},${p.timesOrdered},${p.totalQty},${p.totalRevenue}`);
    });
    lines.push('');
    lines.push('--- BY CATEGORY ---');
    lines.push('Category,Revenue');
    (data?.byCategory || []).forEach((c: any) => {
      lines.push(`${escape(c.category)},${c.revenue}`);
    });
  } else if (reportType === 'approval-summary') {
    lines.push('--- APPROVAL SUMMARY ---');
    lines.push(`Total Requests,${data?.totalRequests ?? 0}`);
    lines.push(`Average Approval Time (Hours),${data?.avgApprovalTimeHours ?? 0}`);
    lines.push('');
    lines.push('--- BY STATUS ---');
    lines.push('Status,Count');
    (data?.byStatus || []).forEach((s: any) => {
      lines.push(`${escape(s.status)},${s.count}`);
    });
  }

  return lines.join('\n');
}
