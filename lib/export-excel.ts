// @ts-ignore
import * as XLSX from 'xlsx-js-style'
import type { HarvestEntryWithProduct, PalletRecord } from './types'
import { formatAucklandDateTime, formatAucklandFileTimestamp } from './auckland-time'

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
    '录入时间': formatAucklandDateTime(e.created_at)
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
    '录入时间': formatAucklandDateTime(e.created_at)
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

/**
 * 导出全量收菜历史数据为 Excel（包含板记录 Sheets 与全量备份字段）
 */
export function exportAllHistory(
  entries: HarvestEntryWithProduct[],
  pallets: PalletRecord[] = []
) {
  // 1. Sheet 1: Harvest Entries Detail
  const data = entries.map((e, index) => ({
    '序号': index + 1,
    'ID': e.id,
    '日期': e.entry_date,
    '区域分类': e.area_category,
    '大棚编号': e.greenhouse_no,
    '团队': e.team,
    '产品 ID': e.product?.product_id ?? '',
    '产品名称': e.product?.factory_product_name ?? '',
    'EXO 编码': e.product?.stockcode ?? '',
    'EXO 描述': e.product?.exo_description ?? '',
    'Bag (包数)': e.bag_qty || 0,
    'Loose (散数)': e.loose_qty || 0,
    '总数': e.total_qty || 0,
    '箱型': e.crate,
    '板型': e.pallet,
    'PalletID': e.pallet_id ?? '',
    '备注': e.notes ?? '',
    'CreatedByID': e.created_by ?? '',
    '录入人': e.created_by_email ?? '',
    'CreatedAt': e.created_at ?? '',
    '录入时间(可读)': e.created_at ? formatAucklandDateTime(e.created_at) : ''
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '全量历史收菜数据')

  // Set column widths for Sheet 1
  worksheet['!cols'] = [
    { wch: 6 },   // 序号
    { wch: 36 },  // ID
    { wch: 12 },  // 日期
    { wch: 15 },  // 区域分类
    { wch: 10 },  // 大棚编号
    { wch: 8 },   // 团队
    { wch: 10 },  // 产品 ID
    { wch: 30 },  // 产品名称
    { wch: 12 },  // EXO 编码
    { wch: 25 },  // EXO 描述
    { wch: 10 },  // Bag (包数)
    { wch: 10 },  // Loose (散数)
    { wch: 10 },  // 总数
    { wch: 12 },  // 箱型
    { wch: 12 },  // 板型
    { wch: 36 },  // PalletID
    { wch: 20 },  // 备注
    { wch: 36 },  // CreatedByID
    { wch: 25 },  // 录入人
    { wch: 25 },  // CreatedAt
    { wch: 20 }   // 录入时间(可读)
  ]

  // 2. Sheet 2: Pallets Records
  if (pallets && pallets.length > 0) {
    const palletData = pallets.map((p, index) => ({
      '序号': index + 1,
      'ID': p.id,
      '日期': p.entry_date,
      '板型': p.pallet_type,
      'CreatedByID': p.created_by ?? '',
      'CreatedByEmail': p.created_by_email ?? '',
      'CreatedAt': p.created_at ?? ''
    }))

    const palletSheet = XLSX.utils.json_to_sheet(palletData)
    palletSheet['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 36 },  // ID
      { wch: 12 },  // 日期
      { wch: 12 },  // 板型
      { wch: 36 },  // CreatedByID
      { wch: 25 },  // CreatedByEmail
      { wch: 25 }   // CreatedAt
    ]
    XLSX.utils.book_append_sheet(workbook, palletSheet, '板记录数据')
  }

  const filename = `HF_Farm_All_Harvest_History_${formatAucklandFileTimestamp()}.xlsx`
  XLSX.writeFile(workbook, filename)
}

function createCell(
  val: any,
  options: {
    bold?: boolean;
    bg?: string;
    color?: string;
    align?: "left" | "right" | "center";
    fontSize?: number;
    border?: boolean;
  } = {}
) {
  const type = typeof val === 'number' ? 'n' : 's';
  const cell: any = { v: val === null || val === undefined ? '' : val, t: type };
  
  // Build style object
  const s: any = {};
  
  // Font
  s.font = {
    name: "Segoe UI",
    sz: options.fontSize || 10,
    bold: !!options.bold,
  };
  if (options.color) {
    s.font.color = { rgb: options.color };
  }
  
  // Fill (background)
  if (options.bg) {
    s.fill = {
      fgColor: { rgb: options.bg }
    };
  }
  
  // Alignment
  s.alignment = {
    horizontal: options.align || (type === 'n' ? 'right' : 'left'),
    vertical: "center"
  };
  
  // Border
  if (options.border) {
    s.border = {
      top: { style: "thin", color: { rgb: "E5E7EB" } },
      bottom: { style: "thin", color: { rgb: "E5E7EB" } },
      left: { style: "thin", color: { rgb: "E5E7EB" } },
      right: { style: "thin", color: { rgb: "E5E7EB" } }
    };
  }
  
  cell.s = s;
  return cell;
}

/**
 * 导出按区域分类垂直布局的 Excel 汇总明细表
 */
export function exportAreaSummaryExcel(
  entries: HarvestEntryWithProduct[],
  date: string
) {
  const categories = ['棚内区域', '户外WF03区域', '外采', '进口', '其他']
  const wsData: any[][] = []
  
  // 1. Title Row
  wsData.push([
    createCell(`HF 农场成品菜区域分类收成汇总表`, { bold: true, fontSize: 14 }),
    ...Array(4).fill(null).map(() => createCell('', {}))
  ])
  
  // 2. Date Row
  wsData.push([
    createCell(`日期: ${date}`, { fontSize: 11, color: "4B5563" }),
    ...Array(4).fill(null).map(() => createCell('', {}))
  ])
  
  // 3. Empty spacer row
  wsData.push(Array(5).fill(null).map(() => createCell('', {})))
  
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Title merge
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }  // Date merge
  ]
  
  categories.forEach(cat => {
    const catEntries = entries.filter(e => e.area_category === cat)
    if (catEntries.length === 0) return
    
    // Group entries by product name
    const productMap = new Map<string, HarvestEntryWithProduct[]>()
    catEntries.forEach(e => {
      const name = e.product?.factory_product_name ?? e.product_id
      if (!productMap.has(name)) productMap.set(name, [])
      productMap.get(name)!.push(e)
    })
    
    const sortedProducts = Array.from(productMap.keys()).sort((a, b) => a.localeCompare(b))
    
    // Calculate category totals
    let catBag = 0
    let catLoose = 0
    let catTotal = 0
    catEntries.forEach(e => {
      catBag += e.bag_qty || 0
      catLoose += e.loose_qty || 0
      catTotal += e.total_qty || 0
    })
    
    // Header for Category with Totals (Slate Gray background, white bold text)
    const catHeaderRow = [
      createCell(`【${cat}】`, { bold: true, bg: "374151", color: "FFFFFF", fontSize: 11 }),
      createCell(catBag || '', { bold: true, bg: "374151", color: "FFFFFF", fontSize: 11, align: "right" }),
      createCell(catLoose || '', { bold: true, bg: "374151", color: "FFFFFF", fontSize: 11, align: "right" }),
      createCell('', { bg: "374151" }),
      createCell(catTotal, { bold: true, bg: "374151", color: "FFFFFF", fontSize: 11, align: "right" })
    ]
    wsData.push(catHeaderRow)
    
    // Table column headers (Light Gray background, dark bold text)
    const colHeaders = [
      createCell('产品名称', { bold: true, bg: "E5E7EB", color: "374151", border: true }),
      createCell('BAG (包数)', { bold: true, bg: "E5E7EB", color: "374151", border: true, align: "right" }),
      createCell('Loose (散数)', { bold: true, bg: "E5E7EB", color: "374151", border: true, align: "right" }),
      createCell('棚号', { bold: true, bg: "E5E7EB", color: "374151", border: true, align: "center" }),
      createCell('总数量', { bold: true, bg: "E5E7EB", color: "374151", border: true, align: "right" })
    ]
    wsData.push(colHeaders)
    
    // Write product rows
    sortedProducts.forEach(pName => {
      const pEntries = productMap.get(pName)!
      
      // Calculate product totals
      let pBag = 0
      let pLoose = 0
      let pTotal = 0
      pEntries.forEach(e => {
        pBag += e.bag_qty || 0
        pLoose += e.loose_qty || 0
        pTotal += e.total_qty || 0
      })
      
      // Greenhouses: aggregate, deduplicate, sort, join with &
      const pGreenhouses = Array.from(new Set(pEntries.map(e => e.greenhouse_no).filter(Boolean))).sort().join('&')
      
      // Product Summary Row (Soft Sage Green background, dark green bold text)
      const pSummaryRow = [
        createCell(pName, { bold: true, bg: "C8E6C9", color: "1B5E20", border: true }),
        createCell(pBag || '', { bold: true, bg: "C8E6C9", color: "1B5E20", border: true, align: "right" }),
        createCell(pLoose || '', { bold: true, bg: "C8E6C9", color: "1B5E20", border: true, align: "right" }),
        createCell(pGreenhouses, { bg: "C8E6C9", border: true, align: "center" }),
        createCell(pTotal, { bold: true, bg: "C8E6C9", color: "1B5E20", border: true, align: "right" })
      ]
      wsData.push(pSummaryRow)
    })
    
    // Add two blank spacer rows between categories
    wsData.push(Array(5).fill(null).map(() => createCell('', {})))
    wsData.push(Array(5).fill(null).map(() => createCell('', {})))
  })
  
  const worksheet = XLSX.utils.aoa_to_sheet(wsData)
  worksheet['!merges'] = merges
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 35 }, // 产品名称
    { wch: 12 }, // BAG
    { wch: 12 }, // Loose
    { wch: 20 }, // 棚号
    { wch: 12 }  // 总数量
  ]
  
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '区域收成汇总')
  
  // Generate filename: YYYY-MM-DD_区域收成汇总表.xlsx
  const filename = `${date}_区域收成汇总表.xlsx`
  XLSX.writeFile(workbook, filename)
}

/**
 * 导出按区域分类垂直布局的 Excel 周汇总表
 */
export function exportAreaWeeklySummaryExcel(
  entries: HarvestEntryWithProduct[],
  startDate: string,
  endDate: string
) {
  const categories = ['棚内区域', '户外WF03区域', '外采', '进口', '其他']
  const wsData: any[][] = []
  
  // 1. Title Row
  wsData.push([
    createCell(`HF 农场成品菜区域分类周汇总表`, { bold: true, fontSize: 14 }),
    createCell('', {})
  ])
  
  // 2. Date Row
  wsData.push([
    createCell(`日期范围: ${startDate} ~ ${endDate}`, { fontSize: 11, color: "4B5563" }),
    createCell('', {})
  ])
  
  // 3. Empty spacer row
  wsData.push(Array(2).fill(null).map(() => createCell('', {})))
  
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Title merge (2 columns)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }  // Date merge
  ]
  
  categories.forEach(cat => {
    const catEntries = entries.filter(e => e.area_category === cat)
    if (catEntries.length === 0) return
    
    // Group entries by product name
    const productMap = new Map<string, HarvestEntryWithProduct[]>()
    catEntries.forEach(e => {
      const name = e.product?.factory_product_name ?? e.product_id
      if (!productMap.has(name)) productMap.set(name, [])
      productMap.get(name)!.push(e)
    })
    
    const sortedProducts = Array.from(productMap.keys()).sort((a, b) => a.localeCompare(b))
    
    // Calculate category totals
    let catTotal = 0
    catEntries.forEach(e => {
      catTotal += e.total_qty || 0
    })
    
    // Header for Category with Totals (Slate Gray background, white bold text)
    const catHeaderRow = [
      createCell(`【${cat}】`, { bold: true, bg: "374151", color: "FFFFFF", fontSize: 11 }),
      createCell(catTotal, { bold: true, bg: "374151", color: "FFFFFF", fontSize: 11, align: "right" })
    ]
    wsData.push(catHeaderRow)
    
    // Table column headers
    const colHeaders = [
      createCell('产品名称', { bold: true, bg: "E5E7EB", color: "374151", border: true }),
      createCell('总数量', { bold: true, bg: "E5E7EB", color: "374151", border: true, align: "right" })
    ]
    wsData.push(colHeaders)
    
    // Write product rows
    sortedProducts.forEach(pName => {
      const pEntries = productMap.get(pName)!
      let pTotal = 0
      pEntries.forEach(e => {
        pTotal += e.total_qty || 0
      })
      
      const pSummaryRow = [
        createCell(pName, { bold: true, bg: "C8E6C9", color: "1B5E20", border: true }),
        createCell(pTotal, { bold: true, bg: "C8E6C9", color: "1B5E20", border: true, align: "right" })
      ]
      wsData.push(pSummaryRow)
    })
    
    // Add two blank spacer rows between categories
    wsData.push(Array(2).fill(null).map(() => createCell('', {})))
    wsData.push(Array(2).fill(null).map(() => createCell('', {})))
  })
  
  const worksheet = XLSX.utils.aoa_to_sheet(wsData)
  worksheet['!merges'] = merges
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 45 }, // 产品名称
    { wch: 15 }  // 总数量
  ]
  
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '区域周收成汇总')
  
  // Generate filename: startDate_至_endDate_区域周收成汇总表.xlsx
  const filename = `${startDate}_至_${endDate}_区域周收成汇总表.xlsx`
  XLSX.writeFile(workbook, filename)
}

/**
 * 导出单日板数与箱型统计为 Excel
 */
export function exportStatsDaily(
  date: string,
  palletStats: { pallet_type: string; new_count: number; old_count: number; total: number }[],
  crateStats: { crate: string; total_qty: number }[],
  hasOldData: boolean
) {
  const workbook = XLSX.utils.book_new()

  // Sheet 1: 板型统计
  const palletRows: any[] = palletStats.map(p => ({
    '板型 (Pallet)': p.pallet_type,
    '物理按板录入数': p.new_count,
    '旧版单条录入数': p.old_count,
    '使用板数合计': p.total,
    '备注': p.old_count > 0 ? '*含旧录入数据(按1条1板)' : '一板多条/整板'
  }))
  if (hasOldData) {
    palletRows.push({
      '板型 (Pallet)': '注：当前包含旧版单条录入数据，旧数据每条记录按 1 板计算',
      '物理按板录入数': '',
      '旧版单条录入数': '',
      '使用板数合计': '',
      '备注': ''
    })
  }

  const palletWs = XLSX.utils.json_to_sheet(palletRows)
  palletWs['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(workbook, palletWs, '板型统计')

  // Sheet 2: 箱型统计
  const crateRows = crateStats.map(c => ({
    '箱型 (Crate)': c.crate,
    '使用总筐数 (Total Qty)': c.total_qty
  }))
  const crateWs = XLSX.utils.json_to_sheet(crateRows)
  crateWs['!cols'] = [{ wch: 20 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(workbook, crateWs, '箱型统计')

  const filename = `${date}_板数筐数统计.xlsx`
  XLSX.writeFile(workbook, filename)
}

/**
 * 导出一周（近7天）板数与箱型统计为 Excel
 */
export async function exportStatsWeekly(endDate: string) {
  const { createClient } = await import('./supabase/client')
  const { PALLETS, CRATES } = await import('./constants')
  const supabase = createClient()
  
  // Calculate 6 days before endDate
  const end = new Date(endDate + 'T00:00:00')
  const dates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  const startDate = dates[0]

  const { data: entries } = await supabase
    .from('harvest_entries')
    .select('id, entry_date, pallet, pallet_id, crate, total_qty')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

  const rows = entries ?? []

  // Collect distinct pallet types & crates
  const palletTypesSet = new Set<string>([...PALLETS])
  const cratesSet = new Set<string>([...CRATES])

  rows.forEach(r => {
    if (r.pallet) palletTypesSet.add(r.pallet)
    if (r.crate) cratesSet.add(r.crate)
  })

  // Date x Pallet matrix calculation
  const palletMatrix: Record<string, Record<string, number>> = {}
  Array.from(palletTypesSet).forEach(p => {
    palletMatrix[p] = {}
    dates.forEach(d => { palletMatrix[p][d] = 0 })
  })

  dates.forEach(d => {
    const dayRows = rows.filter(r => r.entry_date === d)
    const newPallets = new Map<string, string>()
    dayRows.forEach(r => {
      if (r.pallet_id) {
        newPallets.set(r.pallet_id, r.pallet || '未知')
      } else {
        const type = r.pallet || '未分类'
        palletMatrix[type][d] = (palletMatrix[type][d] || 0) + 1
      }
    })
    newPallets.forEach(type => {
      palletMatrix[type][d] = (palletMatrix[type][d] || 0) + 1
    })
  })

  const palletRows = Array.from(palletTypesSet).map(type => {
    const rowObj: any = { '板型': type }
    let total = 0
    dates.forEach(d => {
      const val = palletMatrix[type][d] || 0
      rowObj[d] = val
      total += val
    })
    rowObj['合计使用板数'] = total
    return rowObj
  }).filter(r => r['合计使用板数'] > 0)

  // Date x Crate matrix calculation
  const crateMatrix: Record<string, Record<string, number>> = {}
  Array.from(cratesSet).forEach(c => {
    crateMatrix[c] = {}
    dates.forEach(d => { crateMatrix[c][d] = 0 })
  })

  rows.forEach(r => {
    const c = r.crate || '未知'
    const d = r.entry_date
    if (crateMatrix[c] && crateMatrix[c][d] !== undefined) {
      crateMatrix[c][d] += (r.total_qty || 0)
    }
  })

  const crateRows = Array.from(cratesSet).map(c => {
    const rowObj: any = { '箱型': c }
    let total = 0
    dates.forEach(d => {
      const val = crateMatrix[c][d] || 0
      rowObj[d] = val
      total += val
    })
    rowObj['合计总筐数'] = total
    return rowObj
  }).filter(r => r['合计总筐数'] > 0)

  const workbook = XLSX.utils.book_new()

  const palletWs = XLSX.utils.json_to_sheet(palletRows)
  const crateWs = XLSX.utils.json_to_sheet(crateRows)

  XLSX.utils.book_append_sheet(workbook, palletWs, '板型周统计')
  XLSX.utils.book_append_sheet(workbook, crateWs, '箱型周统计')

  const filename = `${startDate}_至_${endDate}_板数筐数周统计.xlsx`
  XLSX.writeFile(workbook, filename)
}


