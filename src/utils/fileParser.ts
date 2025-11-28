import * as XLSX from 'xlsx';
import * as fs from 'fs';
import csv from 'csv-parser';
import { Readable } from 'stream';

export interface ProductRow {
  name: string;
  category_id?: number | string;
  category_code?: string;
  store_id?: string;
  sku?: string;
  selling_price: number;
  purchase_price: number;
}

export interface InventoryRow {
  product_id?: string;
  sku?: string;
  quantity: number;
  location?: string;
  expiry_date?: string;
  store_id?: string;
}

export async function parseCSV(filePath: string): Promise<ProductRow[]> {
  return new Promise((resolve, reject) => {
    const results: ProductRow[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => {
        results.push({
          name: data.name || data.Name || '',
          category_id: data.category_id || data.categoryId || data['Category ID'] || undefined,
          category_code: data.category_code || data.categoryCode || data['Category Code'] || undefined,
          store_id: data.store_id || data.storeId || data['Store ID'] || undefined,
          sku: data.sku || data.SKU || undefined,
          selling_price: parseFloat(data.selling_price || data.sellingPrice || data['Selling Price'] || '0'),
          purchase_price: parseFloat(data.purchase_price || data.purchasePrice || data['Purchase Price'] || '0'),
        });
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error: Error) => {
        reject(error);
      });
  });
}

export async function parseXLSX(filePath: string): Promise<ProductRow[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No sheet found in Excel file');
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Worksheet not found');
  }
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  return (data as any[]).map((row: any) => ({
    name: row.name || row.Name || '',
    category_id: row.category_id || row.categoryId || row['Category ID'] || undefined,
    category_code: row.category_code || row.categoryCode || row['Category Code'] || undefined,
    store_id: row.store_id || row.storeId || row['Store ID'] || undefined,
    sku: row.sku || row.SKU || undefined,
    selling_price: parseFloat(row.selling_price || row.sellingPrice || row['Selling Price'] || '0'),
    purchase_price: parseFloat(row.purchase_price || row.purchasePrice || row['Purchase Price'] || '0'),
  }));
}

export async function parseCSVInventory(filePath: string): Promise<InventoryRow[]> {
  return new Promise((resolve, reject) => {
    const results: InventoryRow[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => {
        results.push({
          product_id: data.product_id || data.productId || data['Product ID'] || undefined,
          sku: data.sku || data.SKU || undefined,
          quantity: parseFloat(data.quantity || data.Quantity || '0'),
          location: data.location || data.Location || undefined,
          expiry_date: data.expiry_date || data.expiryDate || data['Expiry Date'] || undefined,
          store_id: data.store_id || data.storeId || data['Store ID'] || undefined,
        });
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error: Error) => {
        reject(error);
      });
  });
}

export async function parseXLSXInventory(filePath: string): Promise<InventoryRow[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('No sheet found in Excel file');
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error('Worksheet not found');
  }
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  return (data as any[]).map((row: any) => ({
    product_id: row.product_id || row.productId || row['Product ID'] || undefined,
    sku: row.sku || row.SKU || undefined,
    quantity: parseFloat(row.quantity || row.Quantity || '0'),
    location: row.location || row.Location || undefined,
    expiry_date: row.expiry_date || row.expiryDate || row['Expiry Date'] || undefined,
    store_id: row.store_id || row.storeId || row['Store ID'] || undefined,
  }));
}

export async function parseBuffer(buffer: Buffer, mimetype: string, type: 'product' | 'inventory' = 'product'): Promise<ProductRow[] | InventoryRow[]> {
  if (mimetype === 'text/csv' || mimetype === 'application/csv') {
    // Create a temporary file for CSV parsing
    const tempPath = `/tmp/${Date.now()}.csv`;
    fs.writeFileSync(tempPath, buffer);
    try {
      const result = type === 'inventory' 
        ? await parseCSVInventory(tempPath)
        : await parseCSV(tempPath);
      fs.unlinkSync(tempPath);
      return result;
    } catch (error) {
      fs.unlinkSync(tempPath);
      throw error;
    }
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel'
  ) {
    // Create a temporary file for XLSX parsing
    const tempPath = `/tmp/${Date.now()}.xlsx`;
    fs.writeFileSync(tempPath, buffer);
    try {
      const result = type === 'inventory'
        ? await parseXLSXInventory(tempPath)
        : await parseXLSX(tempPath);
      fs.unlinkSync(tempPath);
      return result;
    } catch (error) {
      fs.unlinkSync(tempPath);
      throw error;
    }
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }
}

