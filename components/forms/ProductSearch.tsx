'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useProducts } from '@/hooks/useProducts'
import type { Product } from '@/lib/types'

interface ProductSearchProps {
  value: string // product id (uuid)
  onChange: (productId: string, product: Product | null) => void
  placeholder?: string
}

export function ProductSearch({ value, onChange, placeholder = '搜索产品名称...' }: ProductSearchProps) {
  const [open, setOpen] = React.useState(false)
  const { data: products = [], isLoading } = useProducts()

  const selectedProduct = products.find(p => p.id === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full h-12 justify-between text-left font-normal text-base',
              !selectedProduct && 'text-muted-foreground',
            )}
          >
            <span className="truncate">
              {selectedProduct
                ? selectedProduct.factory_product_name
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-[500px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="输入产品名称搜索..."
              className="h-12 text-base border-0 focus:ring-0 pl-0"
            />
          </div>
          <CommandList className="max-h-[50dvh]">
            <CommandEmpty>
              {isLoading ? '加载中...' : '未找到匹配产品'}
            </CommandEmpty>
            <CommandGroup>
              {products.map(product => (
                <CommandItem
                  key={product.id}
                  value={product.factory_product_name}
                  onSelect={() => {
                    onChange(product.id === value ? '' : product.id, product.id === value ? null : product)
                    setOpen(false)
                  }}
                  className="py-3"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 flex-shrink-0',
                      value === product.id ? 'opacity-100 text-green-600' : 'opacity-0',
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{product.factory_product_name}</div>
                    {product.stockcode && (
                      <div className="text-xs text-muted-foreground">{product.stockcode}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
