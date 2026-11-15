import type { BanGhiPhieu } from './types.ts'

/**
 * Cổng lưu trữ. Dịch vụ lõi chỉ biết giao diện này.
 * Ticket 02 cắm bộ chuyển Google Sheets vào đây.
 */
export interface KhoPhieu {
  them(banGhi: Omit<BanGhiPhieu, 'id'>): Promise<BanGhiPhieu>
  lay(id: string): Promise<BanGhiPhieu | undefined>
  ghi(banGhi: BanGhiPhieu): Promise<void>
  tatCa(): Promise<BanGhiPhieu[]>
}
