import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';

export type ExportColumnType = 'text' | 'number' | 'currency' | 'date';

export interface ExportColumn {
  key:    string;
  label:  string;
  width?: number;               // characters (xlsx) / relative weight (pdf)
  type?:  ExportColumnType;
}

export interface ReportPayload {
  title:   string;
  columns: ExportColumn[];
  rows:    Record<string, any>[];
}

export type ExportFormat = 'json' | 'csv' | 'xlsx' | 'pdf';

/**
 * Shared, report-agnostic exporter. Turns a { title, columns, rows } payload into
 * CSV, XLSX (exceljs) or PDF (pdfkit). Centralises formatting so every report —
 * old or new — renders consistently.
 */
@Injectable()
export class ExportService {
  // ── CSV ────────────────────────────────────────────────────────────────────
  csv(payload: ReportPayload): string {
    const { columns, rows } = payload;
    const escape = (v: any) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map(c => escape(c.label)).join(',');
    const body = rows.map(r => columns.map(c => escape(this.raw(r[c.key], c))).join(',')).join('\r\n');
    return rows.length ? `${header}\r\n${body}` : header;
  }

  // ── XLSX ───────────────────────────────────────────────────────────────────
  async xlsx(payload: ReportPayload): Promise<Buffer> {
    const { title, columns, rows } = payload;
    const wb = new Workbook();
    wb.creator = 'STALKER';
    wb.created = new Date();
    const ws = wb.addWorksheet(title.slice(0, 28) || 'Report');

    ws.columns = columns.map(c => ({
      header: c.label,
      key:    c.key,
      width:  c.width ?? Math.max(12, c.label.length + 2),
      style:  c.type === 'currency' ? { numFmt: '#,##0.00' } : c.type === 'number' ? { numFmt: '#,##0' } : {},
    }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2236' } };
      cell.font = { bold: true, color: { argb: 'FFE8EDF8' } };
    });

    for (const r of rows) {
      const record: Record<string, any> = {};
      for (const c of columns) record[c.key] = this.cellValue(r[c.key], c);
      ws.addRow(record);
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  async pdf(payload: ReportPayload): Promise<Buffer> {
    const { title, columns, rows } = payload;
    const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const pageLeft  = doc.page.margins.left;
    const pageRight = doc.page.width - doc.page.margins.right;
    const usable    = pageRight - pageLeft;

    // Header
    doc.fontSize(15).fillColor('#1A2236').text(title, { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor('#5A6E96')
      .text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${rows.length} record(s)`);
    doc.moveDown(0.5);

    // Column widths proportional to declared weights
    const totalWeight = columns.reduce((s, c) => s + (c.width ?? 12), 0);
    const colX: number[] = [];
    let x = pageLeft;
    for (const c of columns) { colX.push(x); x += (usable * (c.width ?? 12)) / totalWeight; }

    const rowHeight = 16;
    const drawHeader = (y: number) => {
      doc.rect(pageLeft, y - 2, usable, rowHeight).fill('#1A2236');
      doc.fontSize(7.5).fillColor('#E8EDF8').font('Helvetica-Bold');
      columns.forEach((c, i) => {
        const w = (colX[i + 1] ?? pageRight) - colX[i] - 4;
        doc.text(c.label, colX[i] + 2, y + 2, { width: w, ellipsis: true, lineBreak: false });
      });
      doc.font('Helvetica');
    };

    let y = doc.y;
    drawHeader(y);
    y += rowHeight;

    doc.fontSize(7.5);
    rows.forEach((r, idx) => {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader(y);
        y += rowHeight;
      }
      if (idx % 2 === 1) doc.rect(pageLeft, y - 2, usable, rowHeight).fill('#F2F5FB');
      doc.fillColor('#1A2236');
      columns.forEach((c, i) => {
        const w = (colX[i + 1] ?? pageRight) - colX[i] - 4;
        doc.text(this.display(r[c.key], c), colX[i] + 2, y + 2, { width: w, ellipsis: true, lineBreak: false });
      });
      y += rowHeight;
    });

    doc.end();
    return done;
  }

  contentType(format: ExportFormat): string {
    switch (format) {
      case 'csv':  return 'text/csv';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pdf':  return 'application/pdf';
      default:     return 'application/json';
    }
  }

  // ── value coercion helpers ──
  private raw(v: any, c: ExportColumn) {
    if (v == null) return '';
    if (c.type === 'date') return this.dateStr(v);
    return v;
  }

  private cellValue(v: any, c: ExportColumn) {
    if (v == null) return '';
    if (c.type === 'number' || c.type === 'currency') return Number(v);
    if (c.type === 'date') return this.dateStr(v);
    return v;
  }

  private display(v: any, c: ExportColumn): string {
    if (v == null || v === '') return '—';
    if (c.type === 'currency') return Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (c.type === 'number')   return Number(v).toLocaleString('en-NG');
    if (c.type === 'date')     return this.dateStr(v);
    return String(v);
  }

  private dateStr(v: any): string {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10);
  }
}
