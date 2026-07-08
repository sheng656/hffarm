'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useProducts } from '@/hooks/useProducts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Upload, FileUp, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const supabase = createClient()

export default function ImportPage() {
  const { isAdmin, isLoading: loadingUser } = useUser()
  const { data: products = [] } = useProducts()
  
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [stats, setStats] = useState<{ total: number; valid: number; invalid: number } | null>(null)

  // Map product_id (P0001) to UUID (products.id)
  const productMap = new Map<string, string>()
  products.forEach(p => productMap.set(p.product_id, p.id))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      parseExcel(selectedFile)
    }
  }

  const parseExcel = (file: File) => {
    setParsing(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        
        // Let's find sheet
        const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'register') || workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert to JSON
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet)
        
        if (rawRows.length === 0) {
          toast.error('表格为空或格式不正确')
          setParsing(false)
          return
        }

        // Map and validate
        let validCount = 0
        let invalidCount = 0

        const processed = rawRows.map((row, idx) => {
          const productCode = String(row.Product || '').trim()
          const uuid = productMap.get(productCode)

          const dateVal = row.Date
          let entryDate = ''
          if (dateVal instanceof Date) {
            entryDate = dateVal.toISOString().split('T')[0]
          } else if (typeof dateVal === 'string') {
            entryDate = dateVal.split('T')[0]
          } else if (dateVal) {
            entryDate = String(dateVal).trim()
          }

          const bag = parseInt(row.Bag || row.bag || 0, 10)
          const loose = parseInt(row.Loose || row.loose || 0, 10)
          const teamCode = String(row.Team || '').trim().toUpperCase()
          const crateCode = String(row.Crate || '').trim()
          const palletCode = String(row.Pallet || '').trim()
          const ghCode = String(row.GreenhouseNo || row['Greenhouse No.'] || '').trim()

          // Simple validation rules
          const isValid = !!uuid && !!entryDate && !!teamCode && !!crateCode && (bag > 0 || loose > 0)

          if (isValid) validCount++
          else invalidCount++

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
            isValid,
          }
        })

        setPreview(processed)
        setStats({ total: processed.length, valid: validCount, invalid: invalidCount })
      } catch (err: any) {
        toast.error('解析 Excel 失败: ' + err.message)
      } finally {
        setParsing(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImport = async () => {
    if (!preview || !stats || stats.valid === 0) return
    
    setImporting(true)
    const validRows = preview.filter(r => r.isValid)

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
        toast.success(`成功导入 ${successCount} 条数据！`)
        // Reset states
        setFile(null)
        setPreview(null)
        setStats(null)
      } else {
        toast.warning(`导入部分成功: ${successCount} 条成功, ${failureCount} 条失败`)
      }
    } catch (err: any) {
      toast.error('导入失败: ' + err.message)
    } finally {
      setImporting(false)
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

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-gray-100">
        <CardHeader>
          <CardTitle className="text-base">导入收菜数据流水</CardTitle>
          <CardDescription>
            从 Excel 导入历史登记流水。表头字段需包含: Date, Product (ProductID 如 P0001), Bag, Loose, Crate, Pallet, Greenhouse No., Team, Notes。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
              <div className="grid grid-cols-3 gap-2 bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                <div>
                  <div className="text-xs text-gray-400 font-medium">总数据</div>
                  <div className="text-lg font-bold text-gray-800">{stats.total}</div>
                </div>
                <div>
                  <div className="text-xs text-green-600 font-medium">有效格式</div>
                  <div className="text-lg font-bold text-green-600">{stats.valid}</div>
                </div>
                <div>
                  <div className="text-xs text-red-500 font-medium">无效格式</div>
                  <div className="text-lg font-bold text-red-500">{stats.invalid}</div>
                </div>
              </div>

              {stats.invalid > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 text-amber-900 border border-amber-100 rounded-xl p-3.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold block">检测到无效格式的数据 ({stats.invalid} 条)</span>
                    无效数据通常是由于：产品 ID (如 P0001) 不在产品库中，日期缺失，团队或箱型格式不正确，或者数量全部为 0。<strong>只有有效数据会被导入。</strong>
                  </div>
                </div>
              )}

              {stats.valid > 0 ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setFile(null); setPreview(null); setStats(null) }}
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
                      '确认导入有效数据'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-red-500">
                  未检测到任何有效的行数据，请检查文件格式。
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
