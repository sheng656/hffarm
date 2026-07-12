'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useProducts } from '@/hooks/useProducts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Upload, FileUp, CheckCircle, AlertTriangle, ShieldAlert, CalendarIcon, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { parseExcelDateToAucklandDate, formatAucklandDate, formatAucklandDateLabel, toAucklandCalendarDate } from '@/lib/auckland-time'

const supabase = createClient()

export default function ImportPage() {
  const { isAdmin, isLoading: loadingUser } = useUser()
  const { data: products = [] } = useProducts()
  
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [stats, setStats] = useState<{ total: number; valid: number; invalid: number } | null>(null)
  
  // Date Mode states: 'original' (all) or 'filter' (specific date)
  const [dateMode, setDateMode] = useState<'original' | 'filter'>('original')
  const [filterDate, setFilterDate] = useState(formatAucklandDate())
  const [calOpen, setCalOpen] = useState(false)
  
  // Clear Date states
  const [deleteDate, setDeleteDate] = useState(formatAucklandDate())
  const [deleteCalOpen, setDeleteCalOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [clearStatsCount, setClearStatsCount] = useState<number | null>(null)
  
  // Stats counts
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [filteredOutCount, setFilteredOutCount] = useState(0)

  // Map product_id (P0001) to UUID (products.id)
  const productMap = new Map<string, string>()
  products.forEach(p => productMap.set(p.product_id, p.id))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      parseExcel(selectedFile, dateMode, filterDate)
    }
  }

  const parseExcel = (file: File, selectedDateMode: 'original' | 'filter', selectedFilterDate: string) => {
    setParsing(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        
        // Find sheet
        const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'register') || workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet)
        
        if (rawRows.length === 0) {
          toast.error('表格为空或格式不正确')
          setParsing(false)
          return
        }

        // 1. Map and structurally validate first
        const mappedRows = rawRows.map((row, idx) => {
          const productCode = String(row.Product || '').trim()
          const uuid = productMap.get(productCode)
          const entryDate = parseExcelDateToAucklandDate(row.Date)

          const bag = parseInt(row.Bag || row.bag || 0, 10)
          const loose = parseInt(row.Loose || row.loose || 0, 10)
          const teamCode = String(row.Team || '').trim().toUpperCase()
          const crateCode = String(row.Crate || '').trim()
          const palletCode = String(row.Pallet || '').trim()
          const ghCode = String(row.GreenhouseNo || row['Greenhouse No.'] || '').trim()

          // Date filter: if in filter mode, check if date matches selected date
          const isDateMatched = selectedDateMode !== 'filter' || entryDate === selectedFilterDate

          // Simple structural validation rules (excluding date match for now)
          const isStructurallyValid = !!uuid && !!entryDate && !!teamCode && !!crateCode && (bag > 0 || loose > 0)
          
          const isValid = isStructurallyValid && isDateMatched

          return {
            rowNum: idx + 2,
            entryDate,
            productCode,
            productId: uuid,
            bagQty: bag,
            looseQty: loose,
            crate: crateCode,
            pallet: palletCode || 'NPO',
            greenhouseNo: ghCode || 'GH01',
            team: teamCode,
            notes: row.Notes || row.notes || null,
            created_by_email: row.CreatedBy || null,
            createdAt: row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : null,
            isStructurallyValid,
            isValid,
            isFilteredOut: isStructurallyValid && !isDateMatched,
          }
        })

        // 2. Fetch existing records for duplicate check
        const uniqueDates = Array.from(new Set(mappedRows.filter(r => r.isValid && r.entryDate).map(r => r.entryDate))) as string[]
        
        let existing: any[] = []
        if (uniqueDates.length > 0) {
          const { data: dbRows, error: dbError } = await supabase
            .from('harvest_entries')
            .select('entry_date, product_id, bag_qty, loose_qty, team, greenhouse_no, crate')
            .in('entry_date', uniqueDates)
          if (dbError) {
            console.error('Failed to query existing records:', dbError)
          } else {
            existing = dbRows || []
          }
        }

        let validCount = 0
        let invalidCount = 0
        let dupCount = 0
        let filterCount = 0

        // 3. Separate duplicates and filtered-out rows
        const processed = mappedRows.map(r => {
          if (r.isFilteredOut) {
            filterCount++
            return { ...r, isDuplicate: false }
          }

          if (!r.isStructurallyValid) {
            invalidCount++
            return { ...r, isDuplicate: false }
          }

          // Duplicate condition: exact match on date, product, qty, team, greenhouse, crate
          const isDuplicate = existing.some(ex => 
            ex.entry_date === r.entryDate &&
            ex.product_id === r.productId &&
            ex.bag_qty === r.bagQty &&
            ex.loose_qty === r.looseQty &&
            ex.team === r.team &&
            ex.greenhouse_no === r.greenhouseNo &&
            ex.crate === r.crate
          )

          if (isDuplicate) {
            dupCount++
            return { ...r, isDuplicate: true, isValid: false } // Mark as invalid/duplicate so we skip it
          } else {
            validCount++
            return { ...r, isDuplicate: false }
          }
        })

        setPreview(processed)
        setDuplicateCount(dupCount)
        setFilteredOutCount(filterCount)
        setStats({ total: processed.length, valid: validCount, invalid: invalidCount + dupCount + filterCount })
      } catch (err: any) {
        toast.error('解析 Excel 失败: ' + err.message)
      } finally {
        setParsing(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // Trigger parsing update when dateMode or filterDate changes
  useEffect(() => {
    if (file) {
      parseExcel(file, dateMode, filterDate)
    }
  }, [dateMode, filterDate])

  const handleImport = async () => {
    if (!preview || !stats || stats.valid === 0) return
    
    setImporting(true)
    const validRows = preview.filter(r => r.isValid && !r.isDuplicate && !r.isFilteredOut)

    // Insert in batches of 50
    const batchSize = 50
    let successCount = 0
    let failureCount = 0

    try {
      const { data: { user } } = await supabase.auth.getUser()

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize).map(r => ({
          entry_date: r.entryDate,
          product_id: r.productId,
          bag_qty: r.bagQty,
          loose_qty: r.looseQty,
          crate: r.crate,
          pallet: r.pallet,
          greenhouse_no: r.greenhouseNo,
          team: r.team,
          notes: r.notes,
          created_by: user?.id,
          created_by_email: r.created_by_email || user?.email,
          created_at: r.createdAt || new Date().toISOString()
        }))

        const { error } = await supabase.from('harvest_entries').insert(batch)
        if (error) {
          console.error('Batch error:', error)
          failureCount += batch.length
        } else {
          successCount += batch.length
        }
      }

      if (failureCount === 0) {
        toast.success(`成功导入 ${successCount} 条数据！` + (duplicateCount > 0 ? `（已过滤并跳过 ${duplicateCount} 条重复数据）` : ''))
        // Reset states
        setFile(null)
        setPreview(null)
        setStats(null)
        setDuplicateCount(0)
        setFilteredOutCount(0)
      } else {
        toast.warning(`导入部分成功: ${successCount} 条成功, ${failureCount} 条失败`)
      }
    } catch (err: any) {
      toast.error('导入失败: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  // Clear Date handlers
  const handleClearDateQuery = async () => {
    setClearing(true)
    try {
      const { count, error } = await supabase
        .from('harvest_entries')
        .select('*', { count: 'exact', head: true })
        .eq('entry_date', deleteDate)
      if (error) throw error

      setClearStatsCount(count || 0)
      setConfirmClearOpen(true)
    } catch (err: any) {
      toast.error('查询数据失败: ' + err.message)
    } finally {
      setClearing(false)
    }
  }

  const handleClearDateExecute = async () => {
    setClearing(true)
    setConfirmClearOpen(false)
    try {
      const { error } = await supabase
        .from('harvest_entries')
        .delete()
        .eq('entry_date', deleteDate)
      if (error) throw error

      toast.success(`成功清除 ${deleteDate} 的所有收菜数据！`)
      setClearStatsCount(null)
    } catch (err: any) {
      toast.error('清除失败: ' + err.message)
    } finally {
      setClearing(false)
    }
  }

  if (loadingUser) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-3">
        <ShieldAlert className="w-12 h-12 text-amber-500" />
        <h2 className="font-semibold text-lg text-gray-800">无导入权限</h2>
        <p className="text-gray-500 text-sm">该功能仅限管理员使用，用于初始历史数据或大批量记录导入。</p>
      </div>
    )
  }

  // Calculate actual invalid format count (total stats.invalid - duplicates - filtered)
  const actualInvalidFormat = stats ? (stats.invalid - duplicateCount - filteredOutCount) : 0

  return (
    <div className="space-y-4 pb-12">
      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="text-base">导入收菜数据流水</CardTitle>
          <CardDescription>
            从 Excel 导入历史登记流水。表头字段需包含: Date, Product (ProductID 如 P0001), Bag, Loose, Crate, Pallet, Greenhouse No., Team, Notes。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Date Selection Mode Config */}
          <div className="space-y-3 p-4 bg-gray-50/70 border border-gray-100 rounded-xl">
            <Label className="text-sm font-semibold text-gray-700 block">导入日期模式</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDateMode('original')}
                className={cn(
                  'flex-1 h-10 text-xs font-semibold rounded-lg border transition-all',
                  dateMode === 'original'
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-gray-650 border-gray-200 hover:border-green-200'
                )}
              >
                导入 Excel 中的所有数据
              </button>
              <button
                type="button"
                onClick={() => setDateMode('filter')}
                className={cn(
                  'flex-1 h-10 text-xs font-semibold rounded-lg border transition-all',
                  dateMode === 'filter'
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white text-gray-650 border-gray-200 hover:border-green-200'
                )}
              >
                只导入 Excel 中是指定日期的数据
              </button>
            </div>
            {dateMode === 'filter' && (
              <div className="pt-1.5 space-y-1">
                <Label className="text-xs text-gray-505">选择要导入的指定日期</Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="w-full h-11 justify-between text-sm bg-white">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-green-600" />
                          {formatAucklandDateLabel(filterDate)}
                        </div>
                        <span className="text-xs text-gray-400">点击选择</span>
                      </Button>
                    }
                  />
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={toAucklandCalendarDate(filterDate)}
                      onSelect={date => {
                        if (date) {
                          setFilterDate(formatAucklandDate(date))
                          setCalOpen(false)
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Upload Box */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50 hover:bg-gray-50 hover:border-green-300 transition-colors relative cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-1">
                <FileUp className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {file ? file.name : '点击选择或拖拽 Excel 文件上传'}
              </span>
              <span className="text-xs text-gray-400">仅支持 .xlsx, .xls 格式的文件</span>
            </div>
          </div>

          {parsing && (
            <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
              正在解析 Excel 并验证数据...
            </div>
          )}

          {stats && preview && (
            <div className="space-y-4">
              {/* Stat card */}
              <div className="grid grid-cols-5 gap-1.5 bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                <div>
                  <div className="text-[9px] text-gray-400 font-semibold truncate">总条数</div>
                  <div className="text-sm font-bold text-gray-800">{stats.total}</div>
                </div>
                <div>
                  <div className="text-[9px] text-green-600 font-semibold truncate">可导入</div>
                  <div className="text-sm font-bold text-green-600">{stats.valid}</div>
                </div>
                <div>
                  <div className="text-[9px] text-blue-500 font-semibold truncate">日期不符</div>
                  <div className="text-sm font-bold text-blue-500">{filteredOutCount}</div>
                </div>
                <div>
                  <div className="text-[9px] text-amber-600 font-semibold truncate">已存在(跳过)</div>
                  <div className="text-sm font-bold text-amber-600">{duplicateCount}</div>
                </div>
                <div>
                  <div className="text-[9px] text-red-500 font-semibold truncate">格式错误</div>
                  <div className="text-sm font-bold text-red-500">{actualInvalidFormat}</div>
                </div>
              </div>

              {filteredOutCount > 0 && (
                <div className="flex items-start gap-2.5 bg-blue-50/70 text-blue-900 border border-blue-100 rounded-xl p-3.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">已跳过其他日期的记录 ({filteredOutCount} 条)</span>
                    你开启了日期过滤模式。这 {filteredOutCount} 条记录的日期不是 {filterDate}，因此已自动排除在导入列表之外。
                  </div>
                </div>
              )}

              {duplicateCount > 0 && (
                <div className="flex items-start gap-2.5 bg-amber-50/70 text-amber-900 border border-amber-100 rounded-xl p-3.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">发现已存在的数据 ({duplicateCount} 条)</span>
                    检测到该日期有 {duplicateCount} 条记录与数据库中完全一致。系统在导入时将<strong>自动去重跳过</strong>这些记录，避免重复录入。
                  </div>
                </div>
              )}

              {actualInvalidFormat > 0 && (
                <div className="flex items-start gap-2 bg-red-50 text-red-900 border border-red-100 rounded-xl p-3.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">检测到格式错误的无效数据 ({actualInvalidFormat} 条)</span>
                    无效数据通常是由于：产品 ID 不在产品库中，日期缺失，团队或箱型格式不正确，或者数量全部为 0。<strong>只有有效且不重复的数据会被导入。</strong>
                  </div>
                </div>
              )}

              {stats.valid > 0 ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setFile(null); setPreview(null); setStats(null); setDuplicateCount(0); setFilteredOutCount(0) }}
                    className="flex-1 h-12"
                    disabled={importing}
                  >
                    重新上传
                  </Button>
                  <Button
                    onClick={handleImport}
                    className="flex-1 h-12 bg-green-600 hover:bg-green-700"
                    disabled={importing}
                  >
                    {importing ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />正在导入...</>
                    ) : (
                      `确认导入 ${stats.valid} 条数据`
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-red-500 font-semibold">
                  未检测到任何可导入的新记录，请检查文件。
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dangerous Action Area - Clear Date Data */}
      <Card className="shadow-sm border-red-100 bg-red-50/20">
        <CardHeader>
          <CardTitle className="text-base text-red-800 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            <span>危险操作区：清除指定日期数据</span>
          </CardTitle>
          <CardDescription>
            此操作将彻底删除指定日期内的所有收菜记录。通常用于导入错误后重新清理。请谨慎操作。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-gray-505">选择要清除数据的日期</Label>
            <Popover open={deleteCalOpen} onOpenChange={setDeleteCalOpen}>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-full h-11 justify-between text-sm bg-white border-red-200">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-red-600" />
                      {formatAucklandDateLabel(deleteDate)}
                    </div>
                    <span className="text-xs text-gray-400">点击选择</span>
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={toAucklandCalendarDate(deleteDate)}
                  onSelect={date => {
                    if (date) {
                      setDeleteDate(formatAucklandDate(date))
                      setDeleteCalOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            type="button"
            onClick={handleClearDateQuery}
            disabled={clearing}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
          >
            {clearing ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />正在查询...</>
            ) : (
              '清理该日期全部数据'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-5 bg-red-50 border-b border-red-100 flex items-center gap-3 text-red-900">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-base font-bold">确认清除数据</h3>
                <p className="text-xs text-red-700 mt-0.5">该操作是不可逆的，将从数据库彻底抹去！</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm text-gray-650 leading-relaxed">
                你选择清除 <span className="font-bold text-red-600">{formatAucklandDateLabel(deleteDate)}</span> 的全部收菜记录。
                <br />
                经查询，该日期目前在库中共有 <span className="font-extrabold text-red-600 text-base">{clearStatsCount}</span> 条数据。
                <br />
                点击下方按钮将永久删除这 {clearStatsCount} 条数据，你确定要继续吗？
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-11"
                  onClick={() => setConfirmClearOpen(false)}
                  disabled={clearing}
                >
                  取消
                </Button>
                <Button
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={handleClearDateExecute}
                  disabled={clearing}
                >
                  {clearing ? '正在清理...' : '确定彻底删除'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
