import * as XLSX from 'xlsx'
import type { HarvestEntryWithProduct } from './types'
import { format } from 'date-fns'

/**
 * 导出收菜明细数据为 Excel
 */
export function exportHarvestDetail(
  entries: HarvestEntryWithProduct[],
  date: string,
  team: string
) {
  const data = entries.map((e, index) => ({
    '序号': index + 1,
    '日期': e.entry_date,
    '产品 ID': e.product?.product_id ?? '',
    '产品名称': e.product?.factory_product_name ?? '',
    'EXO 编码': e.product?.stockcode ?? '',
    'EXO 描述': e.product?.exo_description ?? '',
    'Bag (包数)': e.bag_qty || 0,
    'Loose (散数)': e.loose_qty || 0,
    '总数': e.total_qty || 0,
    '箱型': e.crate,
    '板型': e.pallet,
    '大棚编号': e.greenhouse_no,
    '区域分类': e.area_category,
    '团队': e.team,
    '备注': e.notes ?? '',
    '录入人': e.created_by_email ?? '',
    '录入时间': format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss')
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '今日收菜明细')

  // Set column widths
  const maxW = [{ wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 25 }, { wch: 20 }]
  worksheet['!cols'] = maxW

  const filename = `HF_Farm_Harvest_${date}_Team_${team}.xlsx`
  XLSX.writeFile(workbook, filename)
}

/**
 * 导出区域分类明细为 Excel
 */
export function exportAreaDetail(
  entries: HarvestEntryWithProduct[],
  date: string,
  area: string
) {
  const data = entries.map((e, index) => ({
    '序号': index + 1,
    '日期': e.entry_date,
    '区域': e.area_category,
    '大棚编号': e.greenhouse_no,
    '产品名称': e.product?.factory_product_name ?? '',
    'EXO 编码': e.product?.stockcode ?? '',
    'Bag (包数)': e.bag_qty || 0,
    'Loose (散数)': e.loose_qty || 0,
    '总数': e.total_qty || 0,
    '箱型': e.crate,
    '板型': e.pallet,
    '团队': e.team,
    '备注': e.notes ?? '',
    '录入人': e.created_by_email ?? '',
    '录入时间': format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss')
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '区域收菜明细')

  const maxW = [{ wch: 6 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 20 }, { wch: 25 }, { wch: 20 }]
  worksheet['!cols'] = maxW

  const filename = `HF_Farm_Area_${date}_${area}.xlsx`
  XLSX.writeFile(workbook, filename)
}

/**
 * 导出农场成品菜登记表 (格式与 2026.07农场成品菜登记表.xlsx 一致)
 * 根据三类进行分区：
 * 1. 大棚收菜入库 (area_category = '棚内区域')
 * 2. outdoor收菜入库 (area_category = '户外WF03区域')
 * 3. 外采菜加工入库 (area_category = '外采')
 */
export function exportDailyRegister(
  entries: HarvestEntryWithProduct[],
  date: string
) {
  // Find all entries for each section
  const greenhouseEntries = entries.filter(e => e.area_category === '棚内区域')
  const outdoorEntries = entries.filter(e => e.area_category === '户外WF03区域')
  const purchaseEntries = entries.filter(e => e.area_category === '外采')

  // We need to group them by Product, and summarize Qty.
  // Each product should show total_qty, stockcode, exo_description, factory_product_name, etc.
  const formatSection = (secEntries: HarvestEntryWithProduct[]) => {
    const productMap = new Map<string, {
      stockcode: string
      exo_description: string
      factory_name: string
      qty: number
      greenhouse_no: string
      pallet: string
      notes: string
    }>()

    secEntries.forEach(e => {
      const name = e.product?.factory_product_name ?? e.product_id
      const existing = productMap.get(name)
      if (existing) {
        existing.qty += e.total_qty
        // Combine greenhouses/pallets/notes if multiple
        if (e.greenhouse_no && !existing.greenhouse_no.includes(e.greenhouse_no)) {
          existing.greenhouse_no += `, ${e.greenhouse_no}`
        }
        if (e.pallet && !existing.pallet.includes(e.pallet)) {
          existing.pallet += `, ${e.pallet}`
        }
        if (e.notes && !existing.notes.includes(e.notes)) {
          existing.notes += `, ${e.notes}`
        }
      } else {
        productMap.set(name, {
          stockcode: e.product?.stockcode ?? '',
          exo_description: e.product?.exo_description ?? '',
          factory_name: name,
          qty: e.total_qty,
          greenhouse_no: e.greenhouse_no,
          pallet: e.pallet,
          notes: e.notes ?? '',
        })
      }
    })

    return Array.from(productMap.values()).map((p, idx) => [
      null, // Item (A)
      p.stockcode, // Stockcode (B)
      p.exo_description, // EXO Description (C)
      p.factory_name, // Factory Product Name (D)
      0, // 上日库存 (E) - 默认 0
      p.qty, // 当日产量 (F)
      null, // 单价 (G)
      p.greenhouse_no, // 棚号 (H)
      p.qty, // 出货1 (I) - 默认等于当日产量
      null, // 出货2 (J)
      null, // 当日库存 (K) - 导出公式 =E+F-I-J
      p.pallet, // Pallet (L)
      p.notes // 备注 (M)
    ])
  }

  const ghRows = formatSection(greenhouseEntries)
  const odRows = formatSection(outdoorEntries)
  const pcRows = formatSection(purchaseEntries)

  const headers = [
    'Item',
    'Stockcode',
    'EXO Description',
    'Factory Product Name',
    '上日库存',
    '当日产量',
    '单价',
    '棚号',
    '出货1',
    '出货2',
    '当日库存',
    'Pallet',
    '备注'
  ]

  const wsData: any[][] = []

  // Add Greenhouse section
  wsData.push(['大棚收菜入库'])
  wsData.push(headers)
  ghRows.forEach((r, idx) => {
    r[0] = idx + 1 // Item number
    wsData.push(r)
  })

  wsData.push([]) // empty row separator

  // Add Outdoor section
  wsData.push(['outdoor收菜入库'])
  wsData.push(headers)
  odRows.forEach((r, idx) => {
    r[0] = idx + 1
    wsData.push(r)
  })

  wsData.push([]) // empty row separator

  // Add Purchase section
  wsData.push(['外采菜加工入库'])
  wsData.push(headers)
  pcRows.forEach((r, idx) => {
    r[0] = idx + 1
    wsData.push(r)
  })

  const worksheet = XLSX.utils.aoa_to_sheet(wsData)
  
  // Apply formulas for "当日库存" (Column K, index 10)
  // Each data row is index-based. Let's find rows that have product data and insert formula
  wsData.forEach((row, rowIdx) => {
    if (row.length === 13 && typeof row[0] === 'number') {
      const excelRow = rowIdx + 1
      // Formula: E + F - I - J
      // Col E is E, Col F is F, Col I is I, Col J is J
      // Formula text: =E{row}+F{row}-I{row}-IF(ISBLANK(J{row}),0,J{row})
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: 10 })
      worksheet[cellRef] = {
        t: 'n',
        f: `E${excelRow}+F${excelRow}-I${excelRow}-IF(ISBLANK(J${excelRow}),0,J${excelRow})`
      }
    }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, date.replace(/-/g, ''))

  // Set column widths
  const maxW = [
    { wch: 6 },  // Item
    { wch: 12 }, // Stockcode
    { wch: 25 }, // EXO Description
    { wch: 30 }, // Factory Product Name
    { wch: 10 }, // 上日库存
    { wch: 10 }, // 当日产量
    { wch: 8 },  // 单价
    { wch: 15 }, // 棚号
    { wch: 10 }, // 出货1
    { wch: 10 }, // 出货2
    { wch: 12 }, // 当日库存
    { wch: 12 }, // Pallet
    { wch: 20 }  // 备注
  ]
  worksheet['!cols'] = maxW

  const filename = `${date}_農場成品菜登記表.xlsx`
  XLSX.writeFile(workbook, filename)
}
